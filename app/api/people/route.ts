import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getDb, getDefaultWorkspaceId } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const db = getDb();
  const people = db.prepare(`SELECT p.*,
    (SELECT COUNT(*) FROM team_memberships m WHERE m.person_id = p.id) AS team_count,
    (SELECT COUNT(*) FROM project_people m WHERE m.person_id = p.id) AS project_count
    FROM people p WHERE workspace_id = ? ORDER BY active DESC, name COLLATE NOCASE`).all(getDefaultWorkspaceId());
  return NextResponse.json({ people });
}

export async function POST(request: Request) {
  try {
    const { name, email, title } = await request.json();
    if (typeof name !== 'string' || !name.trim() || name.trim().length > 120 ||
        (email && (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)))) {
      return NextResponse.json({ error: 'A name and valid optional email are required' }, { status: 400 });
    }
    const db = getDb();
    const id = uuidv4();
    db.prepare('INSERT INTO people (id, workspace_id, name, email, title, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(id, getDefaultWorkspaceId(), name.trim(), email?.trim() || null, typeof title === 'string' ? title.trim() || null : null, new Date().toISOString());
    return NextResponse.json({ person: db.prepare('SELECT * FROM people WHERE id = ?').get(id) }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Could not add person' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const { id, name, email, title, active } = await request.json();
    const db = getDb();
    const workspaceId = getDefaultWorkspaceId();
    const existing = db.prepare('SELECT id FROM people WHERE id = ? AND workspace_id = ?').get(id, workspaceId);
    if (!existing) return NextResponse.json({ error: 'Person not found' }, { status: 404 });
    if (name !== undefined && (typeof name !== 'string' || !name.trim() || name.trim().length > 120) ||
        email !== undefined && email && (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) ||
        active !== undefined && active !== 0 && active !== 1) {
      return NextResponse.json({ error: 'Invalid person details' }, { status: 400 });
    }
    const updates: string[] = [];
    const values: (string | number | null)[] = [];
    if (name !== undefined) { updates.push('name = ?'); values.push(name.trim()); }
    if (email !== undefined) { updates.push('email = ?'); values.push(email?.trim() || null); }
    if (title !== undefined) { updates.push('title = ?'); values.push(title?.trim() || null); }
    if (active !== undefined) { updates.push('active = ?'); values.push(active); }
    if (!updates.length) return NextResponse.json({ error: 'No changes supplied' }, { status: 400 });
    db.prepare(`UPDATE people SET ${updates.join(', ')} WHERE id = ? AND workspace_id = ?`).run(...values, id, workspaceId);
    return NextResponse.json({ person: db.prepare('SELECT * FROM people WHERE id = ?').get(id) });
  } catch {
    return NextResponse.json({ error: 'Could not update person' }, { status: 500 });
  }
}