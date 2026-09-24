import { NextResponse } from 'next/server';
import { getDb, getDefaultWorkspaceId } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

export async function GET() {
  try {
    const db = getDb();
    const wsId = getDefaultWorkspaceId();

    const notes = db
      .prepare(
        `SELECT n.*, p.name as project_name 
         FROM notes n 
         LEFT JOIN projects p ON n.project_id = p.id 
         WHERE n.workspace_id = ? 
         ORDER BY n.updated_at DESC`
      )
      .all(wsId);

    return NextResponse.json({ notes });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
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
      `INSERT INTO notes (id, workspace_id, project_id, task_id, client_id, title, content, created_at, updated_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(id, wsId, project_id || null, task_id || null, client_id || null, title, content, now, now);

    const note = db.prepare(`SELECT * FROM notes WHERE id = ?`).get(id);
    return NextResponse.json({ note });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
