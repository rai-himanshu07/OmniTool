import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const db = getDb();
    const workstreams = db.prepare(`SELECT * FROM workstreams WHERE project_id = ? ORDER BY created_at ASC`).all(params.id);
    return NextResponse.json({ workstreams });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const db = getDb();
    const body = await request.json();
    const { name, description } = body;
    if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 });

    const id = uuidv4();
    const now = new Date().toISOString();
    db.prepare(`INSERT INTO workstreams (id, project_id, name, description, created_at) VALUES (?, ?, ?, ?, ?)`).run(
      id,
      params.id,
      name,
      description || null,
      now
    );

    const workstream = db.prepare(`SELECT * FROM workstreams WHERE id = ?`).get(id);
    return NextResponse.json({ workstream });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
