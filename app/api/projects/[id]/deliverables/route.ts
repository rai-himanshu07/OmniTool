import { NextRequest, NextResponse } from 'next/server';
import { getDb, getDefaultWorkspaceId } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const db = getDb();
    const deliverables = db.prepare(`SELECT * FROM deliverables WHERE project_id = ? ORDER BY due_date ASC`).all(params.id);
    return NextResponse.json({ deliverables });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const db = getDb();
    const wsId = getDefaultWorkspaceId();
    const body = await request.json();
    const { title, description, due_date } = body;
    if (!title) return NextResponse.json({ error: 'title is required' }, { status: 400 });

    const id = uuidv4();
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO deliverables (id, project_id, title, description, status, due_date, created_at) VALUES (?, ?, ?, ?, 'pending', ?, ?)`
    ).run(id, params.id, title, description || null, due_date || null, now);

    db.prepare(
      `INSERT INTO activity_log (id, workspace_id, entity_type, entity_id, action, details, created_at) VALUES (?, ?, 'project', ?, 'deliverable_added', ?, ?)`
    ).run(uuidv4(), wsId, params.id, `Deliverable added: ${title}`, now);

    const deliverable = db.prepare(`SELECT * FROM deliverables WHERE id = ?`).get(id);
    return NextResponse.json({ deliverable });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
