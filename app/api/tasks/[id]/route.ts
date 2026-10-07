import { AccessError, apiError, getAccess } from '@/lib/services/workspaceAccess';
import { NextRequest, NextResponse } from 'next/server';
import { getDb, getDefaultWorkspaceId } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import { moveToTrash } from '@/lib/services/dataLifecycle';

export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const access = await getAccess(request);
    const db = getDb();
    const task = db.prepare(
      `SELECT t.*, p.name as project_name
       FROM tasks t
       LEFT JOIN projects p ON t.project_id = p.id
       WHERE t.id = ?`
    ).get(params.id) as any;

    if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 });

    task.subtasks = db.prepare(
      `SELECT * FROM subtasks WHERE task_id = ? ORDER BY position ASC`
    ).all(params.id);

    task.dependencies = db.prepare(
      `SELECT td.*, t2.title as depends_on_title, t2.status as depends_on_status
       FROM task_dependencies td
       JOIN tasks t2 ON td.depends_on_task_id = t2.id
       WHERE td.task_id = ?`
    ).all(params.id);

    task.dependents = db.prepare(
      `SELECT td.*, t2.title as task_title, t2.status as task_status
       FROM task_dependencies td
       JOIN tasks t2 ON td.task_id = t2.id
       WHERE td.depends_on_task_id = ?`
    ).all(params.id);

    task.followups = db.prepare(
      `SELECT f.*, CAST(julianday('now') - julianday(f.created_at) AS INTEGER) as waiting_days
       FROM followups f WHERE f.task_id = ? ORDER BY f.created_at DESC`
    ).all(params.id);

    task.activity = db.prepare(
      `SELECT * FROM activity_log WHERE entity_type = 'task' AND entity_id = ? ORDER BY created_at DESC LIMIT 20`
    ).all(params.id);
    task.notes = db.prepare(`SELECT n.id, n.title FROM notes n WHERE n.archived = 0 AND (n.visibility = 'shared' OR n.owner_user_id = ?) AND (n.task_id = ? OR n.id IN (SELECT note_id FROM note_links WHERE linked_entity_type = 'task' AND linked_entity_id = ?))`).all(access.user.id, params.id, params.id);
    task.source_event = task.source_event_id ? db.prepare('SELECT id, title, start_time FROM calendar_events WHERE id = ?').get(task.source_event_id) : null;

    return NextResponse.json({ task });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const db = getDb();
    const wsId = getDefaultWorkspaceId();
    const body = await request.json();
    const { status, priority, due_date, title, description, owner, assignee_person_id } = body;
    const now = new Date().toISOString();

    const existing = db.prepare(`SELECT * FROM tasks WHERE id = ?`).get(params.id);
    if (!existing) return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    if (body.if_match_updated_at && body.if_match_updated_at !== (existing as { updated_at: string }).updated_at) throw new AccessError('This task changed in another tab. Reopen it before saving.', 409);
    if (body.estimated_minutes !== undefined && (!Number.isInteger(body.estimated_minutes) || body.estimated_minutes < 1 || body.estimated_minutes > 10080)) throw new AccessError('Estimate must be between 1 and 10080 minutes');
    if (title !== undefined && (typeof title !== 'string' || !title.trim() || title.length > 500)) throw new AccessError('A non-empty title is required');
    if (status !== undefined && !['inbox', 'open', 'in_progress', 'blocked', 'waiting', 'done', 'cancelled'].includes(status)) throw new AccessError('Invalid status');
    if (priority !== undefined && !['critical', 'high', 'medium', 'low'].includes(priority)) throw new AccessError('Invalid priority');
    if (due_date && (!/^\d{4}-\d{2}-\d{2}$/.test(due_date) || !Number.isFinite(Date.parse(due_date)) || new Date(`${due_date}T00:00:00Z`).toISOString().slice(0, 10) !== due_date)) throw new AccessError('Invalid due date');
    const assignee = assignee_person_id ? db.prepare('SELECT name FROM people WHERE id = ? AND workspace_id = ? AND (active = 1 OR id = ?)').get(assignee_person_id, wsId, (existing as { assignee_person_id?: string }).assignee_person_id) as { name: string } | undefined : undefined;
    if (assignee_person_id && !assignee) return NextResponse.json({ error: 'Person not found' }, { status: 404 });

    const updates: string[] = ['updated_at = ?'];
    const vals: any[] = [now];
    const changes: string[] = [];
  if (body.estimated_minutes !== undefined) { updates.push('estimated_minutes = ?'); vals.push(body.estimated_minutes); }

    if (status !== undefined) { updates.push('status = ?'); vals.push(status); changes.push(`status → ${status}`); if (status === 'done') { updates.push('actual_completion = ?'); vals.push(now); } }
    if (priority !== undefined) { updates.push('priority = ?'); vals.push(priority); changes.push(`priority → ${priority}`); }
    if (due_date !== undefined) { updates.push('due_date = ?'); vals.push(due_date); changes.push(`due_date → ${due_date}`); }
    if (title !== undefined) { updates.push('title = ?'); vals.push(title); }
    if (description !== undefined) { updates.push('description = ?'); vals.push(description); }
    if (assignee_person_id !== undefined) {
      updates.push('assignee_person_id = ?', 'owner = ?');
      vals.push(assignee_person_id || null, assignee?.name || 'Unassigned');
      changes.push('assignee updated');
    } else if (owner !== undefined) {
      updates.push('owner = ?', 'assignee_person_id = NULL'); vals.push(owner);
    }

    vals.push(params.id);
    db.prepare(`UPDATE tasks SET ${updates.join(', ')} WHERE id = ?`).run(...vals);

    if (changes.length > 0) {
      db.prepare(
        `INSERT INTO activity_log (id, workspace_id, entity_type, entity_id, action, details, created_at) VALUES (?, ?, 'task', ?, 'task_updated', ?, ?)`
      ).run(uuidv4(), wsId, params.id, changes.join(', '), now);
    }

    if (status === 'done') {
      db.prepare(`UPDATE recurrence_instances SET status = 'completed', completed_at = ? WHERE task_id = ?`).run(now, params.id);
    }

    const task = db.prepare(`SELECT * FROM tasks WHERE id = ?`).get(params.id);
    return NextResponse.json({ task });
  } catch (error: any) {
    return apiError(error);
  }
}

export async function DELETE(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const db = getDb();
    const wsId = getDefaultWorkspaceId();
    const access = await getAccess(request, ['admin', 'member']);
    const result = moveToTrash(db, 'task', params.id, wsId, access.user.id);
    db.prepare(
      `INSERT INTO activity_log (id, workspace_id, entity_type, entity_id, action, details, created_at) VALUES (?, ?, 'task', ?, 'task_deleted', 'Task deleted', ?)`
    ).run(uuidv4(), wsId, params.id, new Date().toISOString());
    return NextResponse.json(result);
  } catch (error: any) {
    return apiError(error);
  }
}
