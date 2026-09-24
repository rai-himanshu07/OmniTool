import { NextRequest, NextResponse } from 'next/server';
import { auth, authReady } from '@/lib/auth';
import { getDb } from '@/lib/db';

const publicPages = new Set(['/setup', '/sign-in', '/join']);
const adminPaths = ['/api/export', '/api/ai/config', '/api/vault', '/api/calendar/msgraph', '/api/calendar/google', '/api/accounts', '/api/invitations'];

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  try {
    await authReady;
    const users = (getDb().prepare('SELECT COUNT(*) AS count FROM user').get() as { count: number }).count;
    const api = pathname.startsWith('/api/');
    if (pathname.startsWith('/api/auth/')) return NextResponse.next();
    if (publicPages.has(pathname)) {
      if (pathname === '/setup' && users > 0) return NextResponse.redirect(new URL('/sign-in', request.url));
      if (pathname === '/sign-in' && users === 0) return NextResponse.redirect(new URL('/setup', request.url));
      return NextResponse.next();
    }
    if (users === 0) return api
      ? NextResponse.json({ error: 'Admin setup required' }, { status: 401 })
      : NextResponse.redirect(new URL('/setup', request.url));

    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) return api
      ? NextResponse.json({ error: 'Sign in required' }, { status: 401 })
      : NextResponse.redirect(new URL('/sign-in', request.url));
    const access = getDb().prepare('SELECT role FROM account_roles WHERE user_id = ?').get(session.user.id) as { role: string } | undefined;
    if (!access) return NextResponse.json({ error: 'Account access not configured' }, { status: 403 });
    if (access.role !== 'admin' && (pathname === '/settings' || pathname === '/vault' || adminPaths.some((path) => pathname === path || pathname.startsWith(`${path}/`)))) {
      return api ? NextResponse.json({ error: 'Admin access required' }, { status: 403 }) : NextResponse.redirect(new URL('/', request.url));
    }
    if (api && access.role === 'viewer' && pathname !== '/api/screen-lock' && !['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
      return NextResponse.json({ error: 'Read-only account' }, { status: 403 });
    }
    if (api && ['/api/teams', '/api/people'].includes(pathname) && request.method !== 'GET' && access.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }
    return NextResponse.next();
  } catch {
    return NextResponse.json({ error: 'Access control unavailable' }, { status: 503 });
  }
}

export const config = {
  matcher: ['/((?!_next/|__nextjs|favicon.ico|robots.txt).*)'],
};