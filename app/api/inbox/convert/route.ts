import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getDb, getDefaultWorkspaceId } from '@/lib/db';
import { getAccess } from '@/lib/services/workspaceAccess';

export async function POST(request: Request) {
  try {
    const access = await getAccess(request, ['admin', 'member']);
    const { id, kind, title, project_id, waiting_on_person, due_date } = await request.json();
    if (typeof id !== 'string' || typeof title !== 'string' || !title.trim() || title.trim().length > 200 ||
        !['task', 'followup', 'note'].includes(kind) ||
        due_date && (typeof due_date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(due_date) || !Number.isFinite(Date.parse(`${due_date}T00:00:00Z`)) || new Date(`${due_date}T00:00:00Z`).toISOString().slice(0, 10) !== due_date) ||
        kind === 'followup' && (typeof waiting_on_person !== 'string' || !waiting_on_person.trim())) {
      return NextResponse.json({ error: 'Valid title, destination and dates are required' }, { status: 400 });
    }
    const db = getDb();
    const workspaceId = getDefaultWorkspaceId();
    const item = db.prepare(`SELECT content FROM inbox_items WHERE id = ? AND workspace_id = ? AND status = 'raw'`).get(id, workspaceId) as { content: string } | undefined;
    if (!item) return NextResponse.json({ error: 'Capture was already processed or not found' }, { status: 409 });
    if (project_id && !db.prepare('SELECT id FROM projects WHERE id = ? AND workspace_id = ?').get(project_id, workspaceId)) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }
    const createdId = uuidv4();
    const now = new Date().toISOString();
    db.transaction(() => {
      if (kind === 'task') db.prepare(`INSERT INTO tasks (id, workspace_id, project_id, title, description, owner, status, priority, due_date, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, 'open', 'medium', ?, ?, ?)`).run(createdId, workspaceId, project_id || null, title.trim(), item.content, access.user.name, due_date || null, now, now);
      else if (kind === 'followup') db.prepare(`INSERT INTO followups (id, workspace_id, project_id, title, owner, waiting_on_person, category, expected_date, priority, status, created_at, last_activity_at, notes)
        VALUES (?, ?, ?, ?, ?, ?, 'waiting_response', ?, 'medium', 'waiting', ?, ?, ?)`)
        .run(createdId, workspaceId, project_id || null, title.trim(), access.user.name, waiting_on_person.trim(), due_date || null, now, now, item.content);
      else db.prepare(`INSERT INTO notes (id, workspace_id, project_id, title, content, created_at, updated_at, owner_user_id, visibility) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'private')`)
        .run(createdId, workspaceId, project_id || null, title.trim(), item.content, now, now, access.user.id);
      db.prepare(`UPDATE inbox_items SET status = 'triaged', converted_to_type = ?, converted_to_id = ? WHERE id = ? AND workspace_id = ? AND status = 'raw'`)
        .run(kind, createdId, id, workspaceId);
      db.prepare(`INSERT INTO activity_log (id, workspace_id, entity_type, entity_id, action, details, created_at)
        VALUES (?, ?, ?, ?, 'created_from_inbox', 'Converted from Inbox', ?)`)
        .run(uuidv4(), workspaceId, kind, createdId, now);
    })();
    return NextResponse.json({ id: createdId, kind }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Could not process capture; nothing was changed' }, { status: 500 });
  }
}