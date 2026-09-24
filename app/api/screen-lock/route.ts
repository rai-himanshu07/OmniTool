import { NextResponse } from 'next/server';
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { auth, authReady } from '@/lib/auth';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

const attempts = new Map<string, { count: number; blockedUntil: number }>();
const isPin = (value: unknown): value is string => typeof value === 'string' && /^\d{4}$/.test(value);

async function getUserId(request: Request) {
  await authReady;
  return (await auth.api.getSession({ headers: request.headers }))?.user.id;
}

function entry(userId: string) {
  return getDb().prepare('SELECT salt, hash FROM screen_lock_settings WHERE user_id = ?').get(userId) as { salt: string; hash: string } | undefined;
}

function checkPin(userId: string, pin: unknown): NextResponse | null {
  const state = attempts.get(userId) || { count: 0, blockedUntil: 0 };
  if (Date.now() < state.blockedUntil) return NextResponse.json({ error: 'Too many attempts. Try again later.' }, { status: 429 });
  const saved = entry(userId);
  const valid = saved && isPin(pin) && timingSafeEqual(scryptSync(pin, Buffer.from(saved.salt, 'hex'), 32), Buffer.from(saved.hash, 'hex'));
  if (!valid) {
    const count = state.count + 1;
    attempts.set(userId, count >= 5 ? { count: 0, blockedUntil: Date.now() + 60_000 } : { count, blockedUntil: 0 });
    return NextResponse.json({ error: 'Incorrect PIN' }, { status: 401 });
  }
  attempts.delete(userId);
  return null;
}

export async function GET(request: Request) {
  const userId = await getUserId(request);
  if (!userId) return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
  return NextResponse.json({ enabled: !!entry(userId), user_id: userId });
}

export async function PUT(request: Request) {
  try {
    const userId = await getUserId(request);
    if (!userId) return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    if (!entry(userId)) return NextResponse.json({ error: 'PIN is not configured' }, { status: 400 });
    const { pin } = await request.json();
    return checkPin(userId, pin) || NextResponse.json({ unlocked: true });
  } catch { return NextResponse.json({ error: 'Could not unlock' }, { status: 500 }); }
}

export async function POST(request: Request) {
  try {
    const userId = await getUserId(request);
    if (!userId) return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    const { pin, current_pin } = await request.json();
    if (!isPin(pin)) return NextResponse.json({ error: 'Use exactly four digits' }, { status: 400 });
    if (entry(userId)) { const failure = checkPin(userId, current_pin); if (failure) return failure; }
    const salt = randomBytes(16);
    const hash = scryptSync(pin, salt, 32);
    getDb().prepare(`INSERT INTO screen_lock_settings (user_id, salt, hash) VALUES (?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET salt = excluded.salt, hash = excluded.hash`)
      .run(userId, salt.toString('hex'), hash.toString('hex'));
    attempts.delete(userId);
    return NextResponse.json({ enabled: true });
  } catch { return NextResponse.json({ error: 'Could not save PIN' }, { status: 500 }); }
}

export async function DELETE(request: Request) {
  try {
    const userId = await getUserId(request);
    if (!userId) return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    if (!entry(userId)) return NextResponse.json({ enabled: false });
    const { current_pin } = await request.json();
    const failure = checkPin(userId, current_pin);
    if (failure) return failure;
    getDb().prepare('DELETE FROM screen_lock_settings WHERE user_id = ?').run(userId);
    return NextResponse.json({ enabled: false });
  } catch { return NextResponse.json({ error: 'Could not disable PIN' }, { status: 500 }); }
}