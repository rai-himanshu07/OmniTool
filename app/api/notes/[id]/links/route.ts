import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

export async function POST(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const db = getDb();
    const body = await request.json();
    const { linked_entity_type, linked_entity_id } = body;

    if (!linked_entity_type || !linked_entity_id) {
      return NextResponse.json({ error: 'linked_entity_type and linked_entity_id are required' }, { status: 400 });
    }

    const noteExists = db.prepare(`SELECT id FROM notes WHERE id = ?`).get(params.id);
    if (!noteExists) return NextResponse.json({ error: 'Note not found' }, { status: 404 });

    const existing = db
      .prepare(`SELECT id FROM note_links WHERE note_id = ? AND linked_entity_type = ? AND linked_entity_id = ?`)
      .get(params.id, linked_entity_type, linked_entity_id);
    if (existing) {
      return NextResponse.json({ link: existing });
    }

    const id = uuidv4();
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO note_links (id, note_id, linked_entity_type, linked_entity_id, created_at) VALUES (?, ?, ?, ?, ?)`
    ).run(id, params.id, linked_entity_type, linked_entity_id, now);

    return NextResponse.json({ link: { id, note_id: params.id, linked_entity_type, linked_entity_id, created_at: now } });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const db = getDb();
    const linkId = request.nextUrl.searchParams.get('link_id');
    if (!linkId) return NextResponse.json({ error: 'link_id query param is required' }, { status: 400 });

    db.prepare(`DELETE FROM note_links WHERE id = ? AND note_id = ?`).run(linkId, params.id);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
