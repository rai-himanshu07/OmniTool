import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function PUT(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const db = getDb();
    const body = await request.json();
    const { title_encrypted, title_iv, content_encrypted, content_iv } = body;

    if (!title_encrypted || !content_encrypted) {
      return NextResponse.json({ error: 'Encrypted fields missing' }, { status: 400 });
    }

    const now = new Date().toISOString();
    db.prepare(
      `UPDATE secure_notes SET title_encrypted = ?, title_iv = ?, content_encrypted = ?, content_iv = ?, updated_at = ? WHERE id = ?`
    ).run(title_encrypted, title_iv || null, content_encrypted, content_iv || null, now, params.id);

    const note = db.prepare(`SELECT * FROM secure_notes WHERE id = ?`).get(params.id);
    return NextResponse.json({ note });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const db = getDb();
    db.prepare(`DELETE FROM secure_notes WHERE id = ?`).run(params.id);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
