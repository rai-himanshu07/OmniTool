import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getAccess, apiError } from '@/lib/services/workspaceAccess';
import { preferences, validatePreferences } from '@/lib/services/userPreferences';
export async function GET(request: Request) {
  try { const access = await getAccess(request); return NextResponse.json(preferences(access.workspaceId, access.user.id)); } catch (error) { return apiError(error); }
}
export async function PUT(request: Request) {
  try {
    const access = await getAccess(request);
    const value = validatePreferences(await request.json());
    getDb().prepare('INSERT INTO user_preferences VALUES (?, ?, ?) ON CONFLICT(workspace_id, user_id) DO UPDATE SET value_json=excluded.value_json').run(access.workspaceId, access.user.id, JSON.stringify(value));
    return NextResponse.json(value);
  } catch (error) { return apiError(error); }
}