import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getDb, getDefaultWorkspaceId } from '@/lib/db';
import { getAccess } from '@/lib/services/workspaceAccess';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const access = await getAccess(request);
  const db = getDb();
  const workspaceId = getDefaultWorkspaceId();
  const query = new URL(request.url).searchParams.get('q')?.trim();
  const notebooks = db.prepare(`SELECT n.*, (SELECT COUNT(*) FROM notebook_pages p WHERE p.notebook_id = n.id AND p.archived = 0) AS page_count
    FROM notebooks n WHERE n.workspace_id = ? AND (n.visibility = 'shared' OR n.owner_user_id = ?) ORDER BY n.archived, n.updated_at DESC`).all(workspaceId, access.user.id);
  if (!query) return NextResponse.json({ notebooks, matches: [] });
  const matches = db.prepare(`SELECT p.id, p.notebook_id, p.title, p.section, substr(p.plain_text, 1, 180) AS preview, n.name AS notebook_name
    FROM notebook_pages p JOIN notebooks n ON n.id = p.notebook_id
    WHERE n.workspace_id = ? AND (n.visibility = 'shared' OR n.owner_user_id = ?) AND n.archived = 0 AND p.archived = 0 AND (p.title LIKE ? OR p.plain_text LIKE ? OR p.section LIKE ?)
    ORDER BY p.updated_at DESC LIMIT 80`).all(workspaceId, access.user.id, `%${query}%`, `%${query}%`, `%${query}%`);
  return NextResponse.json({ notebooks, matches });
}

export async function POST(request: Request) {
  try {
    const access = await getAccess(request, ['admin', 'member']);
    const { name, description, visibility } = await request.json();
    if (typeof name !== 'string' || !name.trim() || name.trim().length > 160) return NextResponse.json({ error: 'Notebook name is required' }, { status: 400 });
    const id = uuidv4();
    const db = getDb();
    const now = new Date().toISOString();
    db.prepare('INSERT INTO notebooks (id, workspace_id, name, description, created_at, updated_at, owner_user_id, visibility) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .run(id, getDefaultWorkspaceId(), name.trim(), typeof description === 'string' ? description.trim() || null : null, now, now, access.user.id, visibility === 'shared' ? 'shared' : 'private');
    return NextResponse.json({ notebook: db.prepare('SELECT * FROM notebooks WHERE id = ?').get(id) }, { status: 201 });
  } catch { return NextResponse.json({ error: 'Could not create notebook' }, { status: 500 }); }
}