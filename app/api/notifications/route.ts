import { NextRequest, NextResponse } from 'next/server';
import { getDb, getDefaultWorkspaceId } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import { runAttentionSweep } from '@/lib/services/notificationEngine';

export async function GET(request: NextRequest) {
  try {
    const db = getDb();
    const wsId = getDefaultWorkspaceId();

    try {
      runAttentionSweep();
    } catch (err) {
      console.error('runAttentionSweep failed:', err);
    }

    const showAll = request.nextUrl.searchParams.get('all') === 'true';
    const limit = parseInt(request.nextUrl.searchParams.get('limit') || '20');

    let query = `SELECT * FROM notifications WHERE workspace_id = ?`;
    const params: any[] = [wsId];
    if (!showAll) {
      query += ` AND is_read = 0`;
    }
    query += ` ORDER BY created_at DESC LIMIT ?`;
    params.push(limit);

    const notifications = db.prepare(query).all(...params);
    return NextResponse.json({ notifications });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const db = getDb();
    const wsId = getDefaultWorkspaceId();
    const body = await request.json();
    const { type, title, message, entity_type, entity_id } = body;

    if (!type || !title || !message) {
      return NextResponse.json({ error: 'type, title, and message are required' }, { status: 400 });
    }

    const id = uuidv4();
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO notifications (id, workspace_id, type, title, message, entity_type, entity_id, is_read, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)`
    ).run(id, wsId, type, title, message, entity_type || null, entity_id || null, now);

    return NextResponse.json({ notification: { id, type, title, message, is_read: 0, created_at: now } });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const db = getDb();
    const wsId = getDefaultWorkspaceId();
    const body = await request.json();

    if (body.mark_all) {
      db.prepare(`UPDATE notifications SET is_read = 1 WHERE workspace_id = ? AND is_read = 0`).run(wsId);
    } else if (body.ids && Array.isArray(body.ids)) {
      const placeholders = body.ids.map(() => '?').join(',');
      db.prepare(`UPDATE notifications SET is_read = 1 WHERE id IN (${placeholders})`).run(...body.ids);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
