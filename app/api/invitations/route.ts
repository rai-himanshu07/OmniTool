import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getDb, getDefaultWorkspaceId } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const db = getDb();
  const invitations = db.prepare(`SELECT id, email, role, person_id, expires_at, accepted_at, created_at FROM account_invitations
    WHERE workspace_id = ? ORDER BY created_at DESC LIMIT 50`).all(getDefaultWorkspaceId());
  return NextResponse.json({ invitations });
}

export async function POST(request: Request) {
  try {
    const { email, role, person_id } = await request.json();
    if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !['admin', 'member', 'viewer'].includes(role)) {
      return NextResponse.json({ error: 'Valid email and role are required' }, { status: 400 });
    }
    const db = getDb();
    const workspaceId = getDefaultWorkspaceId();
    if (db.prepare('SELECT id FROM user WHERE lower(email) = lower(?)').get(email.trim())) return NextResponse.json({ error: 'An account already uses this email' }, { status: 409 });
    if (person_id && !db.prepare('SELECT id FROM people WHERE id = ? AND workspace_id = ? AND active = 1').get(person_id, workspaceId)) {
      return NextResponse.json({ error: 'Person not found' }, { status: 404 });
    }
    const token = crypto.randomBytes(32).toString('base64url');
    const now = new Date().toISOString();
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    db.transaction(() => {
      db.prepare(`UPDATE account_invitations SET expires_at = ? WHERE workspace_id = ? AND lower(email) = lower(?) AND accepted_at IS NULL`)
        .run(now, workspaceId, email.trim());
      db.prepare(`INSERT INTO account_invitations (id, workspace_id, token_hash, email, role, person_id, expires_at, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(uuidv4(), workspaceId, crypto.createHash('sha256').update(token).digest('hex'), email.trim().toLowerCase(), role, person_id || null, expires, now);
    })();
    const origin = new URL(request.url).origin;
    return NextResponse.json({ invitation_url: `${origin}/join#token=${token}`, expires_at: expires });
  } catch { return NextResponse.json({ error: 'Could not create invitation' }, { status: 500 }); }
}

export async function DELETE(request: Request) {
  const id = new URL(request.url).searchParams.get('id');
  const result = getDb().prepare(`UPDATE account_invitations SET expires_at = ? WHERE id = ? AND workspace_id = ? AND accepted_at IS NULL`)
    .run(new Date().toISOString(), id, getDefaultWorkspaceId());
  return NextResponse.json({ revoked: !!result.changes });
}