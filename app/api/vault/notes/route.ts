import { NextResponse } from 'next/server';
import { getDb, getDefaultWorkspaceId } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

export async function GET() {
  try {
    const db = getDb();
    const wsId = getDefaultWorkspaceId();

    const notes = db
      .prepare(`SELECT id, title_encrypted, title_iv, content_encrypted, content_iv, created_at, updated_at FROM secure_notes WHERE workspace_id = ? ORDER BY updated_at DESC`)
      .all(wsId);

    return NextResponse.json({ notes });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { title_encrypted, title_iv, content_encrypted, content_iv } = body;

    if (!title_encrypted || !content_encrypted) {
      return NextResponse.json({ error: 'Encrypted fields missing' }, { status: 400 });
    }

    const db = getDb();
    const wsId = getDefaultWorkspaceId();
    const id = uuidv4();
    const now = new Date().toISOString();

    db.prepare(
      `INSERT INTO secure_notes (id, workspace_id, title_encrypted, title_iv, content_encrypted, content_iv, created_at, updated_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(id, wsId, title_encrypted, title_iv, content_encrypted, content_iv, now, now);

    const note = db.prepare(`SELECT * FROM secure_notes WHERE id = ?`).get(id);
    return NextResponse.json({ note });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
