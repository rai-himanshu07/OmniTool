import { NextRequest, NextResponse } from 'next/server';
import Database from 'better-sqlite3';
import { getDb, getDefaultWorkspaceId } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import { AccessError, apiError, getAccess } from '@/lib/services/workspaceAccess';
import { moveToTrash } from '@/lib/services/dataLifecycle';

function resolveLinkLabel(db: Database.Database, type: string, id: string): string | null {
  switch (type) {
    case 'project': {
      const row = db.prepare(`SELECT name FROM projects WHERE id = ?`).get(id) as { name: string } | undefined;
      return row?.name || null;
    }
    case 'task': {
      const row = db.prepare(`SELECT title FROM tasks WHERE id = ?`).get(id) as { title: string } | undefined;
      return row?.title || null;
    }
    case 'followup': {
      const row = db.prepare(`SELECT title FROM followups WHERE id = ?`).get(id) as { title: string } | undefined;
      return row?.title || null;
    }
    case 'client': {
      const row = db.prepare(`SELECT name FROM clients WHERE id = ?`).get(id) as { name: string } | undefined;
      return row?.name || null;
    }
    case 'meeting': {
      const row = db.prepare(`SELECT title FROM calendar_events WHERE id = ?`).get(id) as { title: string } | undefined;
      return row?.title || null;
    }
    case 'deliverable': {
      const row = db.prepare(`SELECT title FROM deliverables WHERE id = ?`).get(id) as { title: string } | undefined;
      return row?.title || null;
    }
    default:
      return null;
  }
}

export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const access = await getAccess(request);
    const db = getDb();
    const note = db
      .prepare(`SELECT n.*, p.name as project_name FROM notes n LEFT JOIN projects p ON n.project_id = p.id WHERE n.id = ? AND n.workspace_id = ? AND (n.visibility = 'shared' OR n.owner_user_id = ?)`)
      .get(params.id, access.workspaceId, access.user.id) as any;

    if (!note) return NextResponse.json({ error: 'Note not found' }, { status: 404 });

    const links = db.prepare(`SELECT * FROM note_links WHERE note_id = ? ORDER BY created_at ASC`).all(params.id) as any[];
    note.links = links.map((l) => ({ ...l, label: resolveLinkLabel(db, l.linked_entity_type, l.linked_entity_id) }));

    return NextResponse.json({ note });
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
    const { title, content, project_id, task_id, client_id } = body;
    const now = new Date().toISOString();

    const existing = db.prepare(`SELECT * FROM notes WHERE id = ? AND workspace_id = ? AND (visibility = 'shared' OR owner_user_id = ?)`).get(params.id, wsId, access.user.id) as { owner_user_id: string | null; updated_at: string } | undefined;
    if (!existing) return NextResponse.json({ error: 'Note not found' }, { status: 404 });
    if (body.if_match_updated_at && body.if_match_updated_at !== existing.updated_at) throw new AccessError('This note changed in another tab. Reopen it before saving.', 409);
    if (body.visibility !== undefined && !['private', 'shared'].includes(body.visibility)) throw new AccessError('Invalid visibility');
    if (body.visibility !== undefined && existing.owner_user_id !== access.user.id && !(access.role === 'admin' && !existing.owner_user_id)) throw new AccessError('Only the owner can change visibility', 403);

    const updates: string[] = ['updated_at = ?'];
    const vals: any[] = [now];
    if (body.visibility !== undefined) { updates.push('visibility = ?', 'owner_user_id = ?'); vals.push(body.visibility, existing.owner_user_id || access.user.id); }
    if (title !== undefined) { updates.push('title = ?'); vals.push(title); }
    if (content !== undefined) { updates.push('content = ?'); vals.push(content); }
    if (project_id !== undefined) { updates.push('project_id = ?'); vals.push(project_id || null); }
    if (task_id !== undefined) { updates.push('task_id = ?'); vals.push(task_id || null); }
    if (client_id !== undefined) { updates.push('client_id = ?'); vals.push(client_id || null); }

    vals.push(params.id);
    db.prepare(`UPDATE notes SET ${updates.join(', ')} WHERE id = ?`).run(...vals);

    db.prepare(
      `INSERT INTO activity_log (id, workspace_id, entity_type, entity_id, action, details, created_at) VALUES (?, ?, 'note', ?, 'note_updated', 'Note updated', ?)`
    ).run(uuidv4(), wsId, params.id, now);

    const note = db.prepare(`SELECT * FROM notes WHERE id = ?`).get(params.id);
    return NextResponse.json({ note });
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
    const result = moveToTrash(db, 'note', params.id, wsId, access.user.id);
    db.prepare(
      `INSERT INTO activity_log (id, workspace_id, entity_type, entity_id, action, details, created_at) VALUES (?, ?, 'note', ?, 'note_deleted', 'Note deleted', ?)`
    ).run(uuidv4(), wsId, params.id, new Date().toISOString());
    return NextResponse.json(result);
  } catch (error: any) {
    return apiError(error);
  }
}
