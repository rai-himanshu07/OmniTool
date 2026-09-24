import { NextRequest, NextResponse } from 'next/server';
import { getDb, getDefaultWorkspaceId } from '@/lib/db';

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
    const { name, description, archived } = await request.json();
    const db = getDb();
    const workspaceId = getDefaultWorkspaceId();
    if (!db.prepare('SELECT id FROM notebooks WHERE id = ? AND workspace_id = ?').get(id, workspaceId)) return NextResponse.json({ error: 'Notebook not found' }, { status: 404 });
    if (name !== undefined && (typeof name !== 'string' || !name.trim() || name.trim().length > 160) || archived !== undefined && archived !== 0 && archived !== 1) return NextResponse.json({ error: 'Invalid notebook details' }, { status: 400 });
    db.prepare(`UPDATE notebooks SET name = COALESCE(?, name), description = COALESCE(?, description), archived = COALESCE(?, archived), updated_at = ? WHERE id = ?`)
      .run(name?.trim() || null, description?.trim() || null, archived ?? null, new Date().toISOString(), id);
    return NextResponse.json({ notebook: db.prepare('SELECT * FROM notebooks WHERE id = ?').get(id) });
  } catch { return NextResponse.json({ error: 'Could not update notebook' }, { status: 500 }); }
}