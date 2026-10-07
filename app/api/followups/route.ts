import { NextResponse } from 'next/server';
import { getDb, getDefaultWorkspaceId } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import { Followup } from '@/lib/db/schema';
import { getAccess } from '@/lib/services/workspaceAccess';

export async function GET(request: Request) {
  try {
    const db = getDb();
    const wsId = getDefaultWorkspaceId();

    const status = new URL(request.url).searchParams.get('status');
    if (status && !['waiting', 'escalated', 'resolved', 'cancelled'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }
    const followups = db
      .prepare(
        `SELECT f.*, p.name as project_name, t.title as task_title,
           CAST(julianday(COALESCE(f.resolved_at, 'now')) - julianday(f.last_activity_at) AS INTEGER) as waiting_days
         FROM followups f 
         LEFT JOIN projects p ON f.project_id = p.id 
         LEFT JOIN tasks t ON f.task_id = t.id 
         WHERE f.workspace_id = ? AND f.archived = 0 AND (? IS NULL OR f.status = ?)
         ORDER BY CASE WHEN f.status = 'waiting' THEN 1 WHEN f.status = 'escalated' THEN 2 ELSE 3 END, f.created_at ASC`
      )
      .all(wsId, status, status) as (Followup & { project_name?: string; task_title?: string })[];

    return NextResponse.json({ followups });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const access = await getAccess(request, ['admin', 'member']);
    const body = await request.json();
    const { title, waiting_on_person, waiting_on_person_id, category, expected_date, priority, project_id, task_id, notes, tags } = body;

    if (!title || !waiting_on_person) {
      return NextResponse.json({ error: 'Title and Waiting-on Person are required' }, { status: 400 });
    }
    if (tags !== undefined && (!Array.isArray(tags) || !tags.every((tag: unknown) => typeof tag === 'string'))) {
      return NextResponse.json({ error: 'Tags must be a list of strings' }, { status: 400 });
    }

    const db = getDb();
    const wsId = getDefaultWorkspaceId();
    const person = waiting_on_person_id ? db.prepare('SELECT name FROM people WHERE id = ? AND workspace_id = ? AND active = 1').get(waiting_on_person_id, wsId) as { name: string } | undefined : undefined;
    if (waiting_on_person_id && !person) return NextResponse.json({ error: 'Person not found' }, { status: 404 });
    const id = uuidv4();
    const now = new Date().toISOString();

    db.prepare(
      `INSERT INTO followups (id, workspace_id, project_id, task_id, title, owner, waiting_on_person, waiting_on_person_id, category, expected_date, priority, status, created_at, last_activity_at, notes, tags_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      wsId,
      project_id || null,
      task_id || null,
      title,
      access.user.name,
      person?.name || waiting_on_person,
      waiting_on_person_id || null,
      category || 'waiting_response',
      expected_date || null,
      priority || 'medium',
      'waiting',
      now,
      now,
      notes || null,
      JSON.stringify((tags || []).map((tag: string) => tag.trim()).filter(Boolean))
    );

    const followup = db.prepare(`SELECT * FROM followups WHERE id = ?`).get(id);
    return NextResponse.json({ followup });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, status, notes, expected_date, title, waiting_on_person, waiting_on_person_id, category, priority, project_id, tags, nudge } = body;

    if (!id) {
      return NextResponse.json({ error: 'Followup ID is required' }, { status: 400 });
    }

    const db = getDb();
    const wsId = getDefaultWorkspaceId();
    const existing = db.prepare('SELECT * FROM followups WHERE id = ? AND workspace_id = ?').get(id, wsId) as Followup | undefined;
    if (!existing) return NextResponse.json({ error: 'Follow-up not found' }, { status: 404 });
    if (status !== undefined && !['waiting', 'escalated', 'resolved', 'cancelled'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }
    if (category !== undefined && !['i_do', 'someone_does', 'waiting_response', 'waiting_approval', 'i_promised', 'blocked'].includes(category)) {
      return NextResponse.json({ error: 'Invalid category' }, { status: 400 });
    }
    if (priority !== undefined && !['critical', 'high', 'medium', 'low'].includes(priority)) {
      return NextResponse.json({ error: 'Invalid priority' }, { status: 400 });
    }
    if (nudge && !['waiting', 'escalated'].includes(existing.status)) {
      return NextResponse.json({ error: 'Only active follow-ups can be nudged' }, { status: 400 });
    }
    if (title !== undefined && !String(title).trim() || waiting_on_person !== undefined && !String(waiting_on_person).trim()) {
      return NextResponse.json({ error: 'Title and waiting-on person cannot be empty' }, { status: 400 });
    }
    if (tags !== undefined && (!Array.isArray(tags) || !tags.every((tag: unknown) => typeof tag === 'string'))) {
      return NextResponse.json({ error: 'Tags must be a list of strings' }, { status: 400 });
    }
    const person = waiting_on_person_id ? db.prepare('SELECT name FROM people WHERE id = ? AND workspace_id = ? AND (active = 1 OR id = ?)').get(waiting_on_person_id, wsId, existing.waiting_on_person_id || '') as { name: string } | undefined : undefined;
    if (waiting_on_person_id && !person) return NextResponse.json({ error: 'Person not found' }, { status: 404 });
    const now = new Date().toISOString();
    const updates: string[] = [];
    const params: (string | null)[] = [];
    if (nudge) {
      updates.push('last_activity_at = ?');
      params.push(now);
    }
    if (status !== undefined) {
      updates.push('status = ?');
      params.push(status);
      if (status === 'resolved' || status === 'cancelled') {
        updates.push('resolved_at = ?');
        params.push(now);
      } else if (existing.status === 'resolved' || existing.status === 'cancelled') {
        updates.push('resolved_at = NULL', 'last_activity_at = ?');
        params.push(now);
      }
    }
    if (notes !== undefined) {
      updates.push('notes = ?');
      params.push(notes);
    }
    if (expected_date !== undefined) {
      updates.push('expected_date = ?');
      params.push(expected_date || null);
    }
    if (tags !== undefined) {
      updates.push('tags_json = ?');
      params.push(JSON.stringify(tags.map((tag: string) => tag.trim()).filter(Boolean)));
    }
    if (waiting_on_person_id !== undefined) {
      updates.push('waiting_on_person_id = ?', 'waiting_on_person = ?');
      params.push(waiting_on_person_id || null, person?.name || waiting_on_person || existing.waiting_on_person);
    } else if (waiting_on_person !== undefined) {
      updates.push('waiting_on_person_id = NULL');
    }
    for (const [field, value] of Object.entries({ title, waiting_on_person, category, priority, project_id })) {
      if (field === 'waiting_on_person' && waiting_on_person_id !== undefined) continue;
      if (value !== undefined) {
        updates.push(`${field} = ?`);
        params.push(field === 'project_id' ? value || null : String(value).trim());
      }
    }
    if (updates.length === 0) return NextResponse.json({ error: 'No changes supplied' }, { status: 400 });
    params.push(id, wsId);
    db.transaction(() => {
      db.prepare(`UPDATE followups SET ${updates.join(', ')} WHERE id = ? AND workspace_id = ?`).run(...params);
      db.prepare(`INSERT INTO activity_log (id, workspace_id, entity_type, entity_id, action, details, created_at)
        VALUES (?, ?, 'followup', ?, ?, ?, ?)`)
        .run(uuidv4(), wsId, id, nudge ? 'followup_nudged' : status ? 'followup_status_changed' : 'followup_updated', nudge ? 'Follow-up nudged' : status ? `Status changed to ${status}` : 'Follow-up details updated', now);
    })();

    const followup = db.prepare(`SELECT * FROM followups WHERE id = ?`).get(id);
    return NextResponse.json({ followup });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
