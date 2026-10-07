import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { getDb } from '@/lib/db';
import { getAccess, AccessError, apiError } from '@/lib/services/workspaceAccess';
export async function GET(request: Request) {
  try { const access = await getAccess(request); return NextResponse.json({ reminders: getDb().prepare('SELECT * FROM reminders WHERE workspace_id = ? AND user_id = ? ORDER BY remind_at DESC LIMIT 100').all(access.workspaceId, access.user.id) }); } catch (error) { return apiError(error); }
}
export async function POST(request: Request) {
  try {
    const access = await getAccess(request, ['admin', 'member']);
    const body = await request.json();
    if (!['task', 'followup', 'meeting'].includes(body.entity_type) || typeof body.message !== 'string' || body.message.length > 1000 || !Number.isFinite(Date.parse(body.remind_at)) || Date.parse(body.remind_at) <= Date.now()) throw new AccessError('Select an item and a future reminder time');
    const table = body.entity_type === 'task' ? 'tasks' : body.entity_type === 'followup' ? 'followups' : 'calendar_events';
    if (!getDb().prepare(`SELECT id FROM ${table} WHERE id = ? AND workspace_id = ? AND archived = 0`).get(body.entity_id, access.workspaceId)) throw new AccessError('Item not found', 404);
    getDb().prepare('INSERT INTO reminders (id, workspace_id, entity_type, entity_id, remind_at, message, is_fired, created_at, user_id) VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)')
      .run(randomUUID(), access.workspaceId, body.entity_type, body.entity_id, new Date(body.remind_at).toISOString(), body.message, new Date().toISOString(), access.user.id);
    return NextResponse.json({ success: true });
  } catch (error) { return apiError(error); }
}
export async function DELETE(request: Request) {
  try { const access = await getAccess(request); getDb().prepare('DELETE FROM reminders WHERE id = ? AND user_id = ? AND workspace_id = ?').run(new URL(request.url).searchParams.get('id'), access.user.id, access.workspaceId); return NextResponse.json({ success: true }); } catch (error) { return apiError(error); }
}