import { NextRequest, NextResponse } from 'next/server';
import { getDb, getDefaultWorkspaceId } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import { getCalculatedProjectHealth } from '@/lib/services/attentionEngine';
import { getAccess, AccessError, apiError } from '@/lib/services/workspaceAccess';
import { moveToTrash } from '@/lib/services/dataLifecycle';
import { formatInTimeZone } from 'date-fns-tz';
import { preferences } from '@/lib/services/userPreferences';

export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const access = await getAccess(request);
    const db = getDb();
    const project = db
      .prepare(`SELECT p.*, c.name as client_name FROM projects p LEFT JOIN clients c ON p.client_id = c.id WHERE p.id = ?`)
      .get(params.id) as any;

    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    project.lifecycle_status = project.status;
    project.health = getCalculatedProjectHealth(project.id);
    if (!['completed', 'on_hold'].includes(project.status)) project.status = project.health;

    const tasks = db
      .prepare(
        `SELECT * FROM tasks WHERE project_id = ?
         ORDER BY CASE WHEN priority = 'critical' THEN 1 WHEN priority = 'high' THEN 2 WHEN priority = 'medium' THEN 3 ELSE 4 END, due_date ASC`
      )
      .all(params.id);

    const followups = db
      .prepare(
        `SELECT *, CAST(julianday(COALESCE(resolved_at, 'now')) - julianday(last_activity_at) AS INTEGER) as waiting_days FROM followups WHERE project_id = ? ORDER BY created_at DESC`
      )
      .all(params.id);

    const workstreams = db.prepare(`SELECT * FROM workstreams WHERE project_id = ? ORDER BY created_at ASC`).all(params.id);

    const projectTeams = db.prepare(`SELECT t.id, t.name, t.description FROM project_teams pt JOIN teams t ON t.id = pt.team_id WHERE pt.project_id = ? ORDER BY t.name COLLATE NOCASE`).all(params.id);
    const projectPeople = db.prepare(`SELECT p.id, p.name, p.title, p.active, pp.role FROM project_people pp JOIN people p ON p.id = pp.person_id WHERE pp.project_id = ? ORDER BY p.name COLLATE NOCASE`).all(params.id);
    const teamPeople = db.prepare(`SELECT DISTINCT p.id, p.name, p.title, p.active FROM project_teams pt JOIN team_memberships tm ON tm.team_id = pt.team_id JOIN people p ON p.id = tm.person_id WHERE pt.project_id = ? ORDER BY p.name COLLATE NOCASE`).all(params.id);

    const deliverables = db.prepare(`SELECT * FROM deliverables WHERE project_id = ? ORDER BY due_date ASC`).all(params.id);

    const qcChecklists = db.prepare(`SELECT * FROM qc_checklists WHERE project_id = ? ORDER BY created_at DESC`).all(params.id) as any[];
    for (const checklist of qcChecklists) {
      checklist.items = db.prepare(`SELECT * FROM qc_checklist_items WHERE checklist_id = ? ORDER BY created_at ASC`).all(checklist.id);
    }

    const notes = db
      .prepare(
        `SELECT DISTINCT n.* FROM notes n
         WHERE (n.project_id = ?
         OR n.id IN (SELECT note_id FROM note_links WHERE linked_entity_type = 'project' AND linked_entity_id = ?))
         AND n.archived = 0 AND (n.visibility = 'shared' OR n.owner_user_id = ?)
         ORDER BY n.updated_at DESC`
      )
      .all(params.id, params.id, access.user.id);

    const events = db.prepare(`SELECT * FROM calendar_events WHERE related_project_id = ? ORDER BY start_time ASC`).all(params.id);

    const activity = db
      .prepare(`SELECT * FROM activity_log WHERE entity_type = 'project' AND entity_id = ? ORDER BY created_at DESC LIMIT 40`)
      .all(params.id);

    return NextResponse.json({ project, tasks, followups, workstreams, deliverables, project_teams: projectTeams, project_people: projectPeople, team_people: teamPeople, qc_checklists: qcChecklists, notes, events, activity });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const access = await getAccess(request, ['admin', 'member']);
    const db = getDb();
    const wsId = getDefaultWorkspaceId();
    const body = await request.json();
    const { name, code, client_id, description, owner, owner_person_id, status_override, priority, start_date, planned_delivery_date, actual_delivery_date } = body;
    const now = new Date().toISOString();

    const existing = db.prepare(`SELECT * FROM projects WHERE id = ?`).get(params.id);
    if (!existing) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    if (body.if_match_updated_at && body.if_match_updated_at !== (existing as { updated_at: string }).updated_at) throw new AccessError('Project changed in another tab. Reopen it before saving.', 409);
    const person = owner_person_id ? db.prepare('SELECT name FROM people WHERE id = ? AND workspace_id = ? AND (active = 1 OR id = ?)').get(owner_person_id, wsId, (existing as { owner_person_id?: string }).owner_person_id) as { name: string } | undefined : undefined;
    if (owner_person_id && !person) return NextResponse.json({ error: 'Person not found' }, { status: 404 });

    const updates: string[] = ['updated_at = ?'];
    const vals: any[] = [now];
    const changes: string[] = [];
    if (body.status !== undefined) {
      if (!['active', 'completed', 'on_hold'].includes(body.status)) throw new AccessError('Invalid project lifecycle');
      updates.push('status = ?'); vals.push(body.status === 'active' ? 'green' : body.status);
      changes.push(body.status === 'completed' ? 'project completed' : body.status === 'active' ? 'project reopened' : 'project placed on hold');
      if (body.status === 'completed' && actual_delivery_date === undefined) {
        updates.push('actual_delivery_date = COALESCE(actual_delivery_date, ?)');
        vals.push(formatInTimeZone(new Date(), preferences(wsId, access.user.id).timezone, 'yyyy-MM-dd'));
      }
    }

    if (name !== undefined) { updates.push('name = ?'); vals.push(name); }
    if (code !== undefined) { updates.push('code = ?'); vals.push(code || null); }
    if (client_id !== undefined) { updates.push('client_id = ?'); vals.push(client_id || null); }
    if (description !== undefined) { updates.push('description = ?'); vals.push(description || null); }
    if (owner_person_id !== undefined) { updates.push('owner_person_id = ?', 'owner = ?'); vals.push(owner_person_id || null, person?.name || owner || 'Unassigned'); }
    else if (owner !== undefined) { updates.push('owner = ?', 'owner_person_id = NULL'); vals.push(owner); }
    if (status_override !== undefined) { updates.push('status_override = ?'); vals.push(status_override || null); changes.push(`status override → ${status_override || 'cleared'}`); }
    if (priority !== undefined) { updates.push('priority = ?'); vals.push(priority); }
    if (start_date !== undefined) { updates.push('start_date = ?'); vals.push(start_date || null); }
    if (planned_delivery_date !== undefined) { updates.push('planned_delivery_date = ?'); vals.push(planned_delivery_date || null); changes.push('planned delivery date updated'); }
    if (actual_delivery_date !== undefined) { updates.push('actual_delivery_date = ?'); vals.push(actual_delivery_date || null); }

    vals.push(params.id);
    db.transaction(() => {
      db.prepare(`UPDATE projects SET ${updates.join(', ')} WHERE id = ?`).run(...vals);
      if (body.status === 'completed') db.prepare('UPDATE recurring_obligations SET active = 0 WHERE project_id = ? AND workspace_id = ?').run(params.id, wsId);
      if (owner_person_id && owner_person_id !== (existing as { owner_person_id?: string }).owner_person_id) {
        if ((existing as { owner_person_id?: string }).owner_person_id) db.prepare(`UPDATE project_people SET role = 'member' WHERE project_id = ? AND person_id = ?`).run(params.id, (existing as { owner_person_id?: string }).owner_person_id);
        db.prepare(`INSERT INTO project_people (project_id, person_id, role) VALUES (?, ?, 'lead')
          ON CONFLICT(project_id, person_id) DO UPDATE SET role = 'lead'`).run(params.id, owner_person_id);
      }
    })();

    db.prepare(
      `INSERT INTO activity_log (id, workspace_id, entity_type, entity_id, action, details, created_at) VALUES (?, ?, 'project', ?, 'project_updated', ?, ?)`
    ).run(uuidv4(), wsId, params.id, changes.length ? changes.join(', ') : 'Project details updated', now);

    const project = db.prepare(`SELECT * FROM projects WHERE id = ?`).get(params.id);
    return NextResponse.json({ project });
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
    const result = moveToTrash(db, 'project', params.id, wsId, access.user.id);
    db.prepare(
      `INSERT INTO activity_log (id, workspace_id, entity_type, entity_id, action, details, created_at) VALUES (?, ?, 'project', ?, 'project_deleted', 'Project deleted', ?)`
    ).run(uuidv4(), wsId, params.id, new Date().toISOString());
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
