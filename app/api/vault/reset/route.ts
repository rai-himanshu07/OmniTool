import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { AccessError, apiError, reauthenticate } from '@/lib/services/workspaceAccess';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (body.confirmation !== 'DELETE VAULT') throw new AccessError('Type DELETE VAULT to confirm permanent deletion');
    const access = await reauthenticate(request, body.password);
    const db = getDb();
    db.transaction(() => {
      db.prepare('DELETE FROM secure_notes WHERE workspace_id = ?').run(access.workspaceId);
      db.prepare('DELETE FROM secure_vault_meta WHERE workspace_id = ?').run(access.workspaceId);
    })();
    return NextResponse.json({ success: true });
  } catch (error) { return apiError(error); }
}