import { NextResponse } from 'next/server';
import { getDb, getDefaultWorkspaceId } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const accounts = getDb().prepare(`SELECT u.id, u.name, u.email, a.role, a.person_id, p.name AS person_name
    FROM account_roles a JOIN user u ON u.id = a.user_id LEFT JOIN people p ON p.id = a.person_id
    WHERE a.workspace_id = ? ORDER BY u.name COLLATE NOCASE`).all(getDefaultWorkspaceId());
  return NextResponse.json({ accounts });
}

export async function PUT(request: Request) {
  try {
    const { user_id, role, person_id } = await request.json();
    if (typeof user_id !== 'string' || !['admin', 'member', 'viewer'].includes(role)) return NextResponse.json({ error: 'Invalid account role' }, { status: 400 });
    const db = getDb();
    const wsId = getDefaultWorkspaceId();
    const existing = db.prepare('SELECT role FROM account_roles WHERE user_id = ? AND workspace_id = ?').get(user_id, wsId) as { role: string } | undefined;
    if (!existing) return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    if (existing.role === 'admin' && role !== 'admin' &&
        (db.prepare("SELECT COUNT(*) AS count FROM account_roles WHERE workspace_id = ? AND role = 'admin'").get(wsId) as { count: number }).count <= 1) {
      return NextResponse.json({ error: 'Cannot demote the last administrator' }, { status: 409 });
    }
    if (person_id && !db.prepare('SELECT id FROM people WHERE id = ? AND workspace_id = ?').get(person_id, wsId)) return NextResponse.json({ error: 'Person not found' }, { status: 404 });
    db.prepare('UPDATE account_roles SET role = ?, person_id = ? WHERE user_id = ? AND workspace_id = ?').run(role, person_id || null, user_id, wsId);
    return NextResponse.json({ success: true });
  } catch { return NextResponse.json({ error: 'Could not update account' }, { status: 500 }); }
}