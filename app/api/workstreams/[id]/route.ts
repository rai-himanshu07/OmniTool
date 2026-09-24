import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function PUT(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const db = getDb();
    const body = await request.json();
    const { name, description } = body;
    const updates: string[] = [];
    const vals: any[] = [];
    if (name !== undefined) { updates.push('name = ?'); vals.push(name); }
    if (description !== undefined) { updates.push('description = ?'); vals.push(description || null); }
    if (updates.length === 0) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });

    vals.push(params.id);
    db.prepare(`UPDATE workstreams SET ${updates.join(', ')} WHERE id = ?`).run(...vals);
    const workstream = db.prepare(`SELECT * FROM workstreams WHERE id = ?`).get(params.id);
    return NextResponse.json({ workstream });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const db = getDb();
    db.prepare(`DELETE FROM workstreams WHERE id = ?`).run(params.id);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
