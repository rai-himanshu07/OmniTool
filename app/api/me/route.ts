import { NextResponse } from 'next/server';
import { auth, authReady } from '@/lib/auth';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  await authReady;
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
  const access = getDb().prepare('SELECT role, person_id FROM account_roles WHERE user_id = ?').get(session.user.id);
  if (!access) return NextResponse.json({ error: 'Account access not configured' }, { status: 403 });
  return NextResponse.json({ id: session.user.id, name: session.user.name, email: session.user.email, ...access });
}