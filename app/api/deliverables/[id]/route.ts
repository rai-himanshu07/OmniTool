import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function PUT(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const db = getDb();
    const body = await request.json();
    const { title, description, status, due_date } = body;
    const now = new Date().toISOString();

    const updates: string[] = [];
    const vals: any[] = [];
    if (title !== undefined) { updates.push('title = ?'); vals.push(title); }
    if (description !== undefined) { updates.push('description = ?'); vals.push(description || null); }
    if (due_date !== undefined) { updates.push('due_date = ?'); vals.push(due_date || null); }
    if (status !== undefined) {
      updates.push('status = ?');
      vals.push(status);
      if (status === 'completed') {
        updates.push('completed_at = ?');
        vals.push(now);
      }
    }
    if (updates.length === 0) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });

    vals.push(params.id);
    db.prepare(`UPDATE deliverables SET ${updates.join(', ')} WHERE id = ?`).run(...vals);
    const deliverable = db.prepare(`SELECT * FROM deliverables WHERE id = ?`).get(params.id);
    return NextResponse.json({ deliverable });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const db = getDb();
    db.prepare(`DELETE FROM deliverables WHERE id = ?`).run(params.id);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
