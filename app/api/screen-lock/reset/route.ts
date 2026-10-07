import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { apiError, reauthenticate } from '@/lib/services/workspaceAccess';
export async function POST(request: Request) {
  try { const body = await request.json(); const access = await reauthenticate(request, body.password, ['admin', 'member', 'viewer']); getDb().prepare('DELETE FROM screen_lock_settings WHERE user_id = ?').run(access.user.id); return NextResponse.json({ enabled: false }); } catch (error) { return apiError(error); }
}