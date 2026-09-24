import { NextRequest, NextResponse } from 'next/server';
import { getDb, getDefaultWorkspaceId } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import { validRecurrence } from '@/lib/services/recurrenceEngine';

export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const db = getDb();
    const obligation = db.prepare(
      `SELECT r.*, p.name as project_name FROM recurring_obligations r LEFT JOIN projects p ON r.project_id = p.id WHERE r.id = ? AND r.workspace_id = ?`
    ).get(params.id, getDefaultWorkspaceId());
    if (!obligation) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const instances = db.prepare(
      `SELECT * FROM recurrence_instances WHERE obligation_id = ? ORDER BY due_date DESC LIMIT 20`
    ).all(params.id);

    return NextResponse.json({ obligation, instances });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const db = getDb();
    const wsId = getDefaultWorkspaceId();
    const body = await request.json();
    const { title, description, frequency, recurrence_rule, next_due_date, active, project_id } = body;

    const existing = db.prepare(`SELECT * FROM recurring_obligations WHERE id = ? AND workspace_id = ?`).get(params.id, wsId) as
      { frequency: string; recurrence_rule: string } | undefined;
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if ((frequency !== undefined || recurrence_rule !== undefined) &&
        !validRecurrence(frequency ?? existing.frequency, recurrence_rule ?? existing.recurrence_rule)) {
      return NextResponse.json({ error: 'Invalid recurrence rule' }, { status: 400 });
    }
    if (next_due_date !== undefined && (typeof next_due_date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(next_due_date) ||
        !Number.isFinite(Date.parse(next_due_date)) || new Date(`${next_due_date}T00:00:00Z`).toISOString().slice(0, 10) !== next_due_date)) {
      return NextResponse.json({ error: 'Invalid next due date' }, { status: 400 });
    }
    if (project_id && !db.prepare('SELECT id FROM projects WHERE id = ? AND workspace_id = ?').get(project_id, wsId)) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const changes: string[] = [];
    const values: (string | number | null)[] = [];
    for (const [field, value] of Object.entries({ title, description, frequency, recurrence_rule, next_due_date, active, project_id })) {
      if (value !== undefined) {
        changes.push(`${field} = ?`);
        values.push(field === 'project_id' || field === 'description' ? value || null : value);
      }
    }
    if (!changes.length) return NextResponse.json({ error: 'No changes supplied' }, { status: 400 });
    db.prepare(`UPDATE recurring_obligations SET ${changes.join(', ')} WHERE id = ? AND workspace_id = ?`).run(...values, params.id, wsId);

    db.prepare(
      `INSERT INTO activity_log (id, workspace_id, entity_type, entity_id, action, details, created_at) VALUES (?, ?, 'recurring', ?, 'updated', ?, ?)`
    ).run(uuidv4(), wsId, params.id, `Updated recurring obligation`, new Date().toISOString());

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const db = getDb();
    const wsId = getDefaultWorkspaceId();
    const removed = db.prepare(`DELETE FROM recurring_obligations WHERE id = ? AND workspace_id = ?`).run(params.id, wsId);
    if (!removed.changes) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    db.prepare(
      `INSERT INTO activity_log (id, workspace_id, entity_type, entity_id, action, details, created_at) VALUES (?, ?, 'recurring', ?, 'deleted', 'Deleted recurring obligation', ?)`
    ).run(uuidv4(), wsId, params.id, new Date().toISOString());
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
