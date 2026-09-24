import { NextRequest, NextResponse } from 'next/server';
import { getDb, getDefaultWorkspaceId } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const db = getDb();
    const subtasks = db.prepare(
      `SELECT * FROM subtasks WHERE task_id = ? ORDER BY position ASC`
    ).all(params.id);
    return NextResponse.json({ subtasks });
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
    const { title } = body;

    if (!title) return NextResponse.json({ error: 'Title is required' }, { status: 400 });

    const maxPos = db.prepare(
      `SELECT COALESCE(MAX(position), -1) as max_pos FROM subtasks WHERE task_id = ?`
    ).get(params.id) as any;
    const position = (maxPos?.max_pos ?? -1) + 1;

    const id = uuidv4();
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO subtasks (id, task_id, title, status, position, created_at) VALUES (?, ?, ?, 'open', ?, ?)`
    ).run(id, params.id, title, position, now);

    db.prepare(
      `INSERT INTO activity_log (id, workspace_id, entity_type, entity_id, action, details, created_at) VALUES (?, ?, 'task', ?, 'subtask_added', ?, ?)`
    ).run(uuidv4(), wsId, params.id, `Subtask added: ${title}`, now);

    db.prepare(`UPDATE tasks SET updated_at = ? WHERE id = ?`).run(now, params.id);

    const subtask = db.prepare(`SELECT * FROM subtasks WHERE id = ?`).get(id);
    return NextResponse.json({ subtask });
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
    const { subtask_id, status, title } = body;

    if (!subtask_id) return NextResponse.json({ error: 'subtask_id is required' }, { status: 400 });

    const updates: string[] = [];
    const vals: any[] = [];
    if (status !== undefined) { updates.push('status = ?'); vals.push(status); }
    if (title !== undefined) { updates.push('title = ?'); vals.push(title); }

    if (updates.length === 0) return NextResponse.json({ error: 'No updates provided' }, { status: 400 });

    vals.push(subtask_id);
    db.prepare(`UPDATE subtasks SET ${updates.join(', ')} WHERE id = ?`).run(...vals);

    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO activity_log (id, workspace_id, entity_type, entity_id, action, details, created_at) VALUES (?, ?, 'task', ?, 'subtask_updated', ?, ?)`
    ).run(uuidv4(), wsId, params.id, `Subtask ${status === 'done' ? 'completed' : 'updated'}`, now);

    db.prepare(`UPDATE tasks SET updated_at = ? WHERE id = ?`).run(now, params.id);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const db = getDb();
    const { searchParams } = new URL(request.url);
    const subtaskId = searchParams.get('subtask_id');
    if (!subtaskId) return NextResponse.json({ error: 'subtask_id query param required' }, { status: 400 });
    db.prepare(`DELETE FROM subtasks WHERE id = ? AND task_id = ?`).run(subtaskId, params.id);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
