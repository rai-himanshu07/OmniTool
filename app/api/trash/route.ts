import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { AccessError, apiError, getAccess, reauthenticate } from '@/lib/services/workspaceAccess';
import { lifecycleTables, moveToTrash, restoreTrash } from '@/lib/services/dataLifecycle';

export async function GET(request: Request) {
  try {
    const access = await getAccess(request);
    const db = getDb();
    const items = db.prepare('SELECT id, entity_type, entity_id, title, created_at, expires_at FROM trash_items WHERE workspace_id = ? AND user_id = ? ORDER BY created_at DESC').all(access.workspaceId, access.user.id);
    const archived: any[] = [];
    for (const [type, table] of Object.entries(lifecycleTables).filter(([type]) => !['inbox'].includes(type))) {
      const title = ['project', 'notebook', 'tracker'].includes(type) ? 'name' : 'title';
      const privacy = ['note', 'notebook', 'tracker'].includes(type) ? " AND (visibility = 'shared' OR owner_user_id = ?)" : '';
      archived.push(...db.prepare(`SELECT id, '${type}' AS entity_type, ${title} AS title FROM ${table} WHERE workspace_id = ? AND archived = 1${privacy}`).all(...(privacy ? [access.workspaceId, access.user.id] : [access.workspaceId])));
    }
    return NextResponse.json({ items, archived });
  } catch (error) { return apiError(error); }
}

export async function POST(request: Request) {
  try {
    const access = await getAccess(request, ['admin', 'member']);
    const { id, action, entity_type, entity_id } = await request.json();
    const db = getDb();
    if (action === 'restore') return NextResponse.json(restoreTrash(db, id, access.workspaceId, access.user.id));
    const table = lifecycleTables[entity_type];
    if (!table || !entity_id) throw new AccessError('Invalid record');
    if (action === 'trash') return NextResponse.json(moveToTrash(db, entity_type, entity_id, access.workspaceId, access.user.id));
    if (!['archive', 'unarchive'].includes(action) || entity_type === 'inbox') throw new AccessError('Invalid action');
    const privacy = ['note', 'notebook', 'tracker'].includes(entity_type) ? " AND (visibility = 'shared' OR owner_user_id = ?)" : '';
    const result = db.prepare(`UPDATE ${table} SET archived = ? WHERE id = ? AND workspace_id = ?${privacy}`)
      .run(...(privacy ? [action === 'archive' ? 1 : 0, entity_id, access.workspaceId, access.user.id] : [action === 'archive' ? 1 : 0, entity_id, access.workspaceId]));
    if (!result.changes) throw new AccessError('Record not found', 404);
    return NextResponse.json({ success: true });
  } catch (error) { return apiError(error); }
}

export async function DELETE(request: Request) {
  try {
    const body = await request.json();
    if (body.confirmation !== 'DELETE PERMANENTLY') throw new AccessError('Type DELETE PERMANENTLY to confirm');
    const access = await reauthenticate(request, body.password, ['admin', 'member']);
    const result = getDb().prepare('DELETE FROM trash_items WHERE id = ? AND workspace_id = ? AND user_id = ?').run(body.id, access.workspaceId, access.user.id);
    if (!result.changes) throw new AccessError('Trash item not found', 404);
    return NextResponse.json({ success: true });
  } catch (error) { return apiError(error); }
}