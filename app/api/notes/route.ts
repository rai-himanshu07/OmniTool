import { NextResponse } from 'next/server';
import { getDb, getDefaultWorkspaceId } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import { apiError, getAccess } from '@/lib/services/workspaceAccess';

export async function GET(request: Request) {
  try {
    const access = await getAccess(request);
    const db = getDb();
    const wsId = getDefaultWorkspaceId();

    const notes = db
      .prepare(
        `SELECT n.*, p.name as project_name 
         FROM notes n 
         LEFT JOIN projects p ON n.project_id = p.id 
         WHERE n.workspace_id = ? AND n.archived = 0 AND (n.visibility = 'shared' OR n.owner_user_id = ?)
         ORDER BY n.updated_at DESC`
      )
      .all(wsId, access.user.id);

    return NextResponse.json({ notes });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const access = await getAccess(request, ['admin', 'member']);
    const body = await request.json();
    const { title, content, project_id, task_id, client_id } = body;

    if (!title || !content) {
      return NextResponse.json({ error: 'Title and content are required' }, { status: 400 });
    }

    const db = getDb();
    const wsId = getDefaultWorkspaceId();
    const id = uuidv4();
    const now = new Date().toISOString();

    db.prepare(
      `INSERT INTO notes (id, workspace_id, project_id, task_id, client_id, title, content, created_at, updated_at, owner_user_id, visibility)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
     ).run(id, wsId, project_id || null, task_id || null, client_id || null, title, content, now, now, access.user.id, body.visibility === 'shared' ? 'shared' : 'private');

    const note = db.prepare(`SELECT * FROM notes WHERE id = ?`).get(id);
    return NextResponse.json({ note });
  } catch (error: any) {
    return apiError(error);
  }
}
