import { NextResponse } from 'next/server';
import { getDb, getDefaultWorkspaceId } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

export async function GET() {
  try {
    const db = getDb();
    const wsId = getDefaultWorkspaceId();
    const items = db
      .prepare(`SELECT * FROM inbox_items WHERE workspace_id = ? AND status = 'raw' ORDER BY created_at DESC`)
      .all(wsId);
    return NextResponse.json({ items });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { content, source } = body;

    if (!content) {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 });
    }

    const db = getDb();
    const wsId = getDefaultWorkspaceId();
    const id = uuidv4();
    const now = new Date().toISOString();

    db.prepare(
      `INSERT INTO inbox_items (id, workspace_id, content, source, status, created_at) 
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(id, wsId, content, source || 'quick_capture', 'raw', now);

    const item = db.prepare(`SELECT * FROM inbox_items WHERE id = ?`).get(id);
    return NextResponse.json({ item });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, status, converted_to_type, converted_to_id } = body;

    if (!id) {
      return NextResponse.json({ error: 'Inbox item ID is required' }, { status: 400 });
    }

    const db = getDb();
    db.prepare(
      `UPDATE inbox_items SET status = ?, converted_to_type = ?, converted_to_id = ? WHERE id = ?`
    ).run(status || 'triaged', converted_to_type || null, converted_to_id || null, id);

    const item = db.prepare(`SELECT * FROM inbox_items WHERE id = ?`).get(id);
    return NextResponse.json({ item });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
