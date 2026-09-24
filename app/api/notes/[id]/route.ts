import { NextRequest, NextResponse } from 'next/server';
import Database from 'better-sqlite3';
import { getDb, getDefaultWorkspaceId } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

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
    const db = getDb();
    const note = db
      .prepare(`SELECT n.*, p.name as project_name FROM notes n LEFT JOIN projects p ON n.project_id = p.id WHERE n.id = ?`)
      .get(params.id) as any;

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
    const db = getDb();
    const wsId = getDefaultWorkspaceId();
    const body = await request.json();
    const { title, content, project_id, task_id, client_id } = body;
    const now = new Date().toISOString();

    const existing = db.prepare(`SELECT * FROM notes WHERE id = ?`).get(params.id);
    if (!existing) return NextResponse.json({ error: 'Note not found' }, { status: 404 });

    const updates: string[] = ['updated_at = ?'];
    const vals: any[] = [now];
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
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const db = getDb();
    const wsId = getDefaultWorkspaceId();
    db.prepare(`DELETE FROM notes WHERE id = ?`).run(params.id);
    db.prepare(
      `INSERT INTO activity_log (id, workspace_id, entity_type, entity_id, action, details, created_at) VALUES (?, ?, 'note', ?, 'note_deleted', 'Note deleted', ?)`
    ).run(uuidv4(), wsId, params.id, new Date().toISOString());
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
