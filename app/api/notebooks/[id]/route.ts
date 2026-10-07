import { NextRequest, NextResponse } from 'next/server';
import { getDb, getDefaultWorkspaceId } from '@/lib/db';
import { getAccess } from '@/lib/services/workspaceAccess';

export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const db = getDb();
  const notebook = db.prepare('SELECT * FROM notebooks WHERE id = ? AND workspace_id = ?').get(id, getDefaultWorkspaceId());
  if (!notebook) return NextResponse.json({ error: 'Notebook not found' }, { status: 404 });
  const pages = db.prepare(`SELECT id, title, section, archived, created_at, updated_at, substr(plain_text, 1, 180) AS preview
    FROM notebook_pages WHERE notebook_id = ? ORDER BY archived, updated_at DESC`).all(id);
  return NextResponse.json({ notebook, pages });
}

export async function PUT(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  try {
    const access = await getAccess(request, ['admin', 'member']);
    const { name, description, archived, visibility } = await request.json();
    const db = getDb();
    const workspaceId = getDefaultWorkspaceId();
    if (!db.prepare('SELECT id FROM notebooks WHERE id = ? AND workspace_id = ?').get(id, workspaceId)) return NextResponse.json({ error: 'Notebook not found' }, { status: 404 });
    if (visibility !== undefined) {
      if (!['private', 'shared'].includes(visibility)) return NextResponse.json({ error: 'Invalid visibility' }, { status: 400 });
      const changed = db.prepare('UPDATE notebooks SET visibility = ?, owner_user_id = COALESCE(owner_user_id, ?) WHERE id = ? AND (owner_user_id = ? OR (owner_user_id IS NULL AND ? = 1))')
        .run(visibility, access.user.id, id, access.user.id, access.role === 'admin' ? 1 : 0);
      if (!changed.changes) return NextResponse.json({ error: 'Only the owner can change visibility' }, { status: 403 });
    }
    if (name !== undefined && (typeof name !== 'string' || !name.trim() || name.trim().length > 160) || archived !== undefined && archived !== 0 && archived !== 1) return NextResponse.json({ error: 'Invalid notebook details' }, { status: 400 });
    db.prepare(`UPDATE notebooks SET name = COALESCE(?, name), description = COALESCE(?, description), archived = COALESCE(?, archived), updated_at = ? WHERE id = ?`)
      .run(name?.trim() || null, description?.trim() || null, archived ?? null, new Date().toISOString(), id);
    return NextResponse.json({ notebook: db.prepare('SELECT * FROM notebooks WHERE id = ?').get(id) });
  } catch { return NextResponse.json({ error: 'Could not update notebook' }, { status: 500 }); }
}