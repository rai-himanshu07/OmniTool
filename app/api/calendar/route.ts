import { NextResponse } from 'next/server';
import { getDb, getDefaultWorkspaceId } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

export async function GET() {
  try {
    const db = getDb();
    const wsId = getDefaultWorkspaceId();

    const events = db
      .prepare(
        `SELECT ce.*, p.name as project_name, cs.provider as provider
         FROM calendar_events ce 
         LEFT JOIN projects p ON ce.related_project_id = p.id 
         LEFT JOIN calendar_sources cs ON ce.calendar_source_id = cs.id
         WHERE ce.workspace_id = ? 
         ORDER BY ce.start_time ASC`
      )
      .all(wsId);

    const sources = db.prepare(`SELECT provider, last_synced_at, refresh_token_enc IS NOT NULL AS connected
      FROM calendar_sources WHERE workspace_id = ?`).all(wsId);
    return NextResponse.json({ events, sources });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { title, start_time, end_time, location, related_project_id } = body;

    if (!title || !start_time || !end_time) {
      return NextResponse.json({ error: 'Title, start time, and end time are required' }, { status: 400 });
    }
    if (!Number.isFinite(Date.parse(start_time)) || !Number.isFinite(Date.parse(end_time)) || Date.parse(end_time) <= Date.parse(start_time)) {
      return NextResponse.json({ error: 'End time must be after start time' }, { status: 400 });
    }

    const db = getDb();
    const wsId = getDefaultWorkspaceId();
    const id = uuidv4();
    const now = new Date().toISOString();

    db.prepare(
      `INSERT INTO calendar_events (id, workspace_id, title, start_time, end_time, location, is_all_day, related_project_id, created_at) 
       VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)`
    ).run(id, wsId, title, start_time, end_time, location || null, related_project_id || null, now);

    const event = db.prepare(`SELECT * FROM calendar_events WHERE id = ?`).get(id);
    return NextResponse.json({ event });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const { id, title, start_time, end_time, location, related_project_id } = await request.json();
    if (!id || !title?.trim() || !Number.isFinite(Date.parse(start_time)) || !Number.isFinite(Date.parse(end_time)) || Date.parse(end_time) <= Date.parse(start_time)) {
      return NextResponse.json({ error: 'A title and valid start/end times are required' }, { status: 400 });
    }
    const db = getDb();
    const result = db.prepare(
      `UPDATE calendar_events SET title = ?, start_time = ?, end_time = ?, location = ?, related_project_id = ?
       WHERE id = ? AND workspace_id = ? AND source_id IS NULL AND calendar_source_id IS NULL`
    ).run(title.trim(), start_time, end_time, location || null, related_project_id || null, id, getDefaultWorkspaceId());
    if (!result.changes) return NextResponse.json({ error: 'Local event not found' }, { status: 404 });
    return NextResponse.json({ event: db.prepare('SELECT * FROM calendar_events WHERE id = ?').get(id) });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const id = new URL(request.url).searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Event ID is required' }, { status: 400 });
    const result = getDb().prepare(
      `DELETE FROM calendar_events WHERE id = ? AND workspace_id = ? AND source_id IS NULL AND calendar_source_id IS NULL`
    ).run(id, getDefaultWorkspaceId());
    if (!result.changes) return NextResponse.json({ error: 'Local event not found' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
