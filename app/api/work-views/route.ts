import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { AccessError, apiError, getAccess } from '@/lib/services/workspaceAccess';

export async function GET(request: Request) {
  try {
    const access = await getAccess(request);
    const views = getDb().prepare('SELECT id, name, filters_json FROM saved_views WHERE workspace_id = ? AND user_id = ? ORDER BY name').all(access.workspaceId, access.user.id) as { id: string; name: string; filters_json: string }[];
    return NextResponse.json({ views: views.map((view) => ({ id: view.id, name: view.name, filters: JSON.parse(view.filters_json) })) });
  } catch (error) { return apiError(error); }
}
export async function POST(request: Request) {
  try {
    const access = await getAccess(request, ['admin', 'member']);
    const body = await request.json();
    if (typeof body.name !== 'string' || !body.name.trim() || body.name.length > 80 || !body.filters || JSON.stringify(body.filters).length > 2000) throw new AccessError('Invalid saved view');
    const filters = Object.fromEntries(Object.entries(body.filters).filter(([key, value]) => ['scope', 'period', 'project_id', 'client_id', 'person_id', 'priority'].includes(key) && typeof value === 'string'));
    const db = getDb();
    if ((db.prepare('SELECT COUNT(*) AS count FROM saved_views WHERE user_id = ?').get(access.user.id) as { count: number }).count >= 40) throw new AccessError('Maximum 40 saved views');
    db.prepare('INSERT INTO saved_views VALUES (?, ?, ?, ?, ?, ?)').run(randomUUID(), access.workspaceId, access.user.id, body.name.trim(), JSON.stringify(filters), new Date().toISOString());
    return NextResponse.json({ success: true });
  } catch (error) { return apiError(error); }
}
export async function DELETE(request: Request) {
  try {
    const access = await getAccess(request, ['admin', 'member']);
    getDb().prepare('DELETE FROM saved_views WHERE id = ? AND user_id = ? AND workspace_id = ?').run(new URL(request.url).searchParams.get('id'), access.user.id, access.workspaceId);
    return NextResponse.json({ success: true });
  } catch (error) { return apiError(error); }
}