import { NextResponse } from 'next/server';
import { getDb, getDefaultWorkspaceId } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

export async function GET() {
  try {
    const db = getDb();
    const wsId = getDefaultWorkspaceId();

    const meta = db.prepare(`SELECT * FROM secure_vault_meta WHERE workspace_id = ?`).get(wsId);
    return NextResponse.json({ meta: meta || { is_initialized: 0 } });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { key_salt, test_ciphertext, test_iv, kdf_iterations } = body;

    if (!key_salt || !test_ciphertext || !test_iv) {
      return NextResponse.json({ error: 'Vault parameters missing' }, { status: 400 });
    }

    const db = getDb();
    const wsId = getDefaultWorkspaceId();
    const id = uuidv4();
    const now = new Date().toISOString();
    const iterations = kdf_iterations || 600000;
    if (db.prepare('SELECT id FROM secure_vault_meta WHERE workspace_id = ?').get(wsId)) return NextResponse.json({ error: 'Vault already initialized. Unlock to change its password, or explicitly reset it.' }, { status: 409 });
    if (!Number.isInteger(iterations) || iterations < 600000 || iterations > 2000000) return NextResponse.json({ error: 'Invalid key derivation parameters' }, { status: 400 });

    db.prepare(
      `INSERT INTO secure_vault_meta (id, workspace_id, is_initialized, key_salt, test_ciphertext, test_iv, kdf_iterations, updated_at) 
      VALUES (?, ?, 1, ?, ?, ?, ?, ?)`
    ).run(id, wsId, key_salt, test_ciphertext, test_iv, iterations, now);

    const meta = db.prepare(`SELECT * FROM secure_vault_meta WHERE workspace_id = ?`).get(wsId);
    return NextResponse.json({ meta });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
