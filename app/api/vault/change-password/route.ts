import { NextResponse } from 'next/server';
import { getDb, getDefaultWorkspaceId } from '@/lib/db';

// Atomically rotates the vault master password: the server never sees a
// plaintext password or derived key, only the already re-encrypted result of
// a client-side decrypt(old)/re-encrypt(new) pass. Wrapped in one SQLite
// transaction so a mid-way failure can never leave some notes encrypted with
// the old key and others with the new key.
export async function POST(request: Request) {
  try {
    const db = getDb();
    const wsId = getDefaultWorkspaceId();
    const body = await request.json();
    const { key_salt, test_ciphertext, test_iv, kdf_iterations, notes } = body;

    if (!key_salt || !test_ciphertext || !test_iv || !Array.isArray(notes)) {
      return NextResponse.json({ error: 'Missing vault re-encryption parameters' }, { status: 400 });
    }

    const now = new Date().toISOString();

    const applyChange = db.transaction(() => {
      db.prepare(
        `UPDATE secure_vault_meta SET key_salt = ?, test_ciphertext = ?, test_iv = ?, kdf_iterations = ?, updated_at = ? WHERE workspace_id = ?`
      ).run(key_salt, test_ciphertext, test_iv, kdf_iterations || 600000, now, wsId);

      const updateNote = db.prepare(
        `UPDATE secure_notes SET title_encrypted = ?, title_iv = ?, content_encrypted = ?, content_iv = ?, updated_at = ? WHERE id = ? AND workspace_id = ?`
      );
      for (const n of notes) {
        updateNote.run(n.title_encrypted, n.title_iv, n.content_encrypted, n.content_iv, now, n.id, wsId);
      }
    });

    applyChange();

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
