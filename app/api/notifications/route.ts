import { NextRequest, NextResponse } from 'next/server';
import { getDb, getDefaultWorkspaceId } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import { runAttentionSweep } from '@/lib/services/notificationEngine';
import { AccessError, apiError, getAccess } from '@/lib/services/workspaceAccess';
import { preferences } from '@/lib/services/userPreferences';

export async function GET(request: NextRequest) {
  try {
    const db = getDb();
    const access = await getAccess(request);
    const wsId = access.workspaceId;
    const prefs = preferences(wsId, access.user.id);

    try {
      runAttentionSweep();
    } catch (err) {
      console.error('runAttentionSweep failed:', err);
    }

    const now = new Date();
    const meetings = db.prepare('SELECT id, title FROM calendar_events WHERE workspace_id = ? AND archived = 0 AND start_time > ? AND start_time <= ?').all(wsId, now.toISOString(), new Date(now.getTime() + prefs.meeting_lead_minutes * 60000).toISOString()) as { id: string; title: string }[];
    for (const meeting of meetings) if (!db.prepare("SELECT id FROM notifications WHERE workspace_id = ? AND user_id = ? AND type = 'meeting_soon' AND entity_id = ?").get(wsId, access.user.id, meeting.id)) {
      db.prepare("INSERT INTO notifications (id, workspace_id, type, title, message, entity_type, entity_id, is_read, created_at, user_id) VALUES (?, ?, 'meeting_soon', 'Meeting starting soon', ?, 'meeting', ?, 0, ?, ?)").run(uuidv4(), wsId, meeting.title, meeting.id, now.toISOString(), access.user.id);
    }
    const showAll = request.nextUrl.searchParams.get('all') === 'true';
    const limit = Math.max(1, Math.min(100, Number(request.nextUrl.searchParams.get('limit')) || 40));
    const notifications = prefs.enabled_types.length ? db.prepare(`SELECT n.*, COALESCE(r.is_read, n.is_read) AS is_read FROM notifications n
      LEFT JOIN notification_receipts r ON r.notification_id = n.id AND r.user_id = ?
      WHERE n.workspace_id = ? AND (n.user_id IS NULL OR n.user_id = ?) AND (r.snoozed_until IS NULL OR r.snoozed_until <= ?)
      AND n.type IN (${prefs.enabled_types.map(() => '?').join(',')}) ${showAll ? '' : 'AND COALESCE(r.is_read, n.is_read) = 0'}
      AND (n.entity_type IS NULL OR n.entity_type <> 'task' OR EXISTS (SELECT 1 FROM tasks t WHERE t.id = n.entity_id AND t.archived = 0 AND t.status NOT IN ('done', 'cancelled')))
      AND (n.entity_type IS NULL OR n.entity_type <> 'followup' OR EXISTS (SELECT 1 FROM followups f WHERE f.id = n.entity_id AND f.archived = 0 AND f.status NOT IN ('resolved', 'cancelled')))
      ORDER BY n.created_at DESC LIMIT ?`).all(access.user.id, wsId, access.user.id, now.toISOString(), ...prefs.enabled_types, limit) : [];
    const time = new Intl.DateTimeFormat('en-GB', { timeZone: prefs.timezone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(now);
    const quiet = prefs.quiet_start && prefs.quiet_end && (prefs.quiet_start < prefs.quiet_end ? time >= prefs.quiet_start && time < prefs.quiet_end : time >= prefs.quiet_start || time < prefs.quiet_end);
    return NextResponse.json({ notifications, desktop_allowed: prefs.desktop_alerts && !quiet, delivery: 'open-app' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const access = await getAccess(request, ['admin', 'member']);
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
      `INSERT INTO notifications (id, workspace_id, type, title, message, entity_type, entity_id, is_read, created_at, user_id) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`
    ).run(id, wsId, type, title, message, entity_type || null, entity_id || null, now, access.user.id);

    return NextResponse.json({ notification: { id, type, title, message, is_read: 0, created_at: now } });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const db = getDb();
    const access = await getAccess(request);
    const wsId = access.workspaceId;
    const body = await request.json();
    const ids = body.mark_all ? (db.prepare('SELECT id FROM notifications WHERE workspace_id = ? AND (user_id IS NULL OR user_id = ?)').all(wsId, access.user.id) as { id: string }[]).map((item) => item.id) : body.ids;
    if (!Array.isArray(ids) || !body.mark_all && ids.length > 100) throw new AccessError('Invalid notifications');
    if (body.snooze_minutes !== undefined && (!Number.isInteger(body.snooze_minutes) || body.snooze_minutes < 5 || body.snooze_minutes > 10080)) throw new AccessError('Snooze must be 5-10080 minutes');
    const until = body.snooze_minutes ? new Date(Date.now() + body.snooze_minutes * 60000).toISOString() : null;
    db.transaction(() => { for (const id of ids) {
      if (!db.prepare('SELECT id FROM notifications WHERE id = ? AND workspace_id = ? AND (user_id IS NULL OR user_id = ?)').get(id, wsId, access.user.id)) throw new AccessError('Notification not found', 404);
      db.prepare('INSERT INTO notification_receipts VALUES (?, ?, ?, ?) ON CONFLICT(notification_id, user_id) DO UPDATE SET is_read=excluded.is_read, snoozed_until=excluded.snoozed_until').run(id, access.user.id, until ? 0 : 1, until);
    } })();
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return apiError(error);
  }
}
