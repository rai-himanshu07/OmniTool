import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getDb, getDefaultWorkspaceId } from '@/lib/db';
import { getWeeklySnapshot, weekBounds } from '@/lib/services/weeklyReview';

export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
  const db = getDb();
  const wsId = getDefaultWorkspaceId();
  const snapshot = getWeeklySnapshot();
  const reviewed = db.prepare('SELECT wins, risks, next_week, completed_at FROM weekly_reviews WHERE workspace_id = ? AND user_id = ? AND week_start = ?')
    .get(wsId, session.user.id, snapshot.week.start) || null;
  return NextResponse.json({ ...snapshot, reviewed });
}

export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
  let body: { wins?: unknown; risks?: unknown; next_week?: unknown; complete?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid review' }, { status: 400 }); }
  if (![body.wins, body.risks, body.next_week].every((value) => typeof value === 'string' && value.length <= 5000) || typeof body.complete !== 'boolean') {
    return NextResponse.json({ error: 'Review fields must be text under 5000 characters' }, { status: 400 });
  }
  const db = getDb();
  const now = new Date().toISOString();
  const week = weekBounds();
  db.prepare(`INSERT INTO weekly_reviews (workspace_id, user_id, week_start, wins, risks, next_week, completed_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(workspace_id, user_id, week_start) DO UPDATE SET wins = excluded.wins, risks = excluded.risks,
    next_week = excluded.next_week, completed_at = CASE WHEN excluded.completed_at IS NOT NULL THEN excluded.completed_at ELSE weekly_reviews.completed_at END,
    updated_at = excluded.updated_at`).run(getDefaultWorkspaceId(), session.user.id, week.start,
    body.wins, body.risks, body.next_week, body.complete ? now : null, now);
  return NextResponse.json({ success: true, completed_at: body.complete ? now : null });
}