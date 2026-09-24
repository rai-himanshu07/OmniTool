import { NextRequest, NextResponse } from 'next/server';
import { getDb, getDefaultWorkspaceId } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import { validRecurrence } from '@/lib/services/recurrenceEngine';

const validDate = (value: unknown): value is string => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  Number.isFinite(Date.parse(value)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;

export async function GET(request: NextRequest) {
  try {
    const db = getDb();
    const wsId = getDefaultWorkspaceId();
    const activeOnly = request.nextUrl.searchParams.get('active') === 'true';
    const projectId = request.nextUrl.searchParams.get('project_id');

    let query = `SELECT r.*, p.name as project_name FROM recurring_obligations r LEFT JOIN projects p ON r.project_id = p.id WHERE r.workspace_id = ?`;
    const params: any[] = [wsId];

    if (activeOnly) { query += ` AND r.active = 1`; }
    if (projectId) { query += ` AND r.project_id = ?`; params.push(projectId); }
    query += ` ORDER BY r.next_due_date ASC`;

    const obligations = db.prepare(query).all(...params);
    return NextResponse.json({ obligations });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const db = getDb();
    const wsId = getDefaultWorkspaceId();
    const body = await request.json();
    const { title, description, frequency, recurrence_rule, next_due_date, project_id } = body;

    if (!title || !frequency || !recurrence_rule || !next_due_date) {
      return NextResponse.json({ error: 'title, frequency, recurrence_rule, and next_due_date are required' }, { status: 400 });
    }
    if (!validRecurrence(frequency, recurrence_rule) || !validDate(next_due_date)) {
      return NextResponse.json({ error: 'Invalid recurrence rule or first due date' }, { status: 400 });
    }
    if (project_id && !db.prepare('SELECT id FROM projects WHERE id = ? AND workspace_id = ?').get(project_id, wsId)) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const id = uuidv4();
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO recurring_obligations (id, workspace_id, project_id, title, description, frequency, recurrence_rule, next_due_date, active, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`
    ).run(id, wsId, project_id || null, title, description || null, frequency, recurrence_rule, next_due_date, now);

    db.prepare(
      `INSERT INTO activity_log (id, workspace_id, entity_type, entity_id, action, details, created_at) VALUES (?, ?, 'recurring', ?, 'created', ?, ?)`
    ).run(uuidv4(), wsId, id, `Created recurring obligation: ${title}`, now);

    return NextResponse.json({ obligation: { id, title, frequency, recurrence_rule, next_due_date } });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
