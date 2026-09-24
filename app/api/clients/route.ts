import { NextResponse } from 'next/server';
import { getDb, getDefaultWorkspaceId } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

export async function GET() {
  try {
    const db = getDb();
    const wsId = getDefaultWorkspaceId();
    const clients = db.prepare(`SELECT * FROM clients WHERE workspace_id = ? ORDER BY name ASC`).all(wsId);
    return NextResponse.json({ clients });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, code, contact_person, email } = body;

    if (!name) {
      return NextResponse.json({ error: 'Client name is required' }, { status: 400 });
    }

    const db = getDb();
    const wsId = getDefaultWorkspaceId();
    const id = uuidv4();
    const now = new Date().toISOString();

    db.prepare(
      `INSERT INTO clients (id, workspace_id, name, code, contact_person, email, created_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(id, wsId, name, code || null, contact_person || null, email || null, now);

    const client = db.prepare(`SELECT * FROM clients WHERE id = ?`).get(id);
    return NextResponse.json({ client });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
