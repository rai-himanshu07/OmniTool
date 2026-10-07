import { NextResponse } from 'next/server';
import { auth, authReady } from '@/lib/auth';
import { getDb, getDefaultWorkspaceId } from '@/lib/db';

export class AccessError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

export async function getAccess(request: Request, roles = ['admin', 'member', 'viewer']) {
  await authReady;
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) throw new AccessError('Sign in required', 401);
  const workspaceId = getDefaultWorkspaceId();
  const access = getDb().prepare('SELECT role, person_id FROM account_roles WHERE user_id = ? AND workspace_id = ?')
    .get(session.user.id, workspaceId) as { role: string; person_id: string | null } | undefined;
  if (!access || !roles.includes(access.role)) throw new AccessError('Access denied', 403);
  return { ...access, user: session.user, workspaceId };
}

export async function reauthenticate(request: Request, password: unknown, roles = ['admin']) {
  const access = await getAccess(request, roles);
  if (typeof password !== 'string' || !password) throw new AccessError('Your account password is required');
  const db = getDb();
  const attemptKey = `reauth:${access.user.id}`;
  const stored = db.prepare('SELECT value FROM settings WHERE key = ?').get(attemptKey) as { value: string } | undefined;
  const attempt = stored ? JSON.parse(stored.value) as { count: number; until: number } : { count: 0, until: 0 };
  if (attempt.until > Date.now() && attempt.count >= 5) throw new AccessError('Too many attempts. Try again in 15 minutes.', 429);
  const account = db.prepare("SELECT password FROM account WHERE userId = ? AND providerId = 'credential'")
    .get(access.user.id) as { password: string } | undefined;
  const context = await auth.$context;
  if (!account?.password || !await context.password.verify({ hash: account.password, password })) {
    const count = attempt.until > Date.now() ? attempt.count + 1 : 1;
    db.prepare('INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at')
      .run(attemptKey, JSON.stringify({ count, until: Date.now() + 15 * 60000 }), new Date().toISOString());
    throw new AccessError('Account password is incorrect', 403);
  }
  db.prepare('DELETE FROM settings WHERE key = ?').run(attemptKey);
  return access;
}

export function apiError(error: unknown) {
  return NextResponse.json({ error: error instanceof Error ? error.message : 'Request failed' },
    { status: error instanceof AccessError ? error.status : 500 });
}