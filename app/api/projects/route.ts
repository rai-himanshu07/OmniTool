import { NextResponse } from 'next/server';
import { getDb, getDefaultWorkspaceId } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import { Project } from '@/lib/db/schema';
import { getCalculatedProjectHealth } from '@/lib/services/attentionEngine';

export async function GET() {
  try {
    const db = getDb();
    const wsId = getDefaultWorkspaceId();
    const todayStr = new Date().toISOString().split('T')[0];

    const projects = db
      .prepare(
        `SELECT p.*, c.name as client_name 
         FROM projects p 
         LEFT JOIN clients c ON p.client_id = c.id 
         WHERE p.workspace_id = ? AND p.archived = 0
         ORDER BY p.created_at DESC`
      )
      .all(wsId) as (Project & { client_name?: string })[];

    for (const p of projects) {
      p.lifecycle_status = p.status;
      p.health = getCalculatedProjectHealth(p.id);
      if (!['completed', 'on_hold'].includes(p.status)) p.status = p.health;
      p.tasks_count = (db.prepare(`SELECT COUNT(*) as c FROM tasks WHERE project_id = ? AND archived = 0`).get(p.id) as { c: number }).c;
      p.overdue_tasks_count = (
        db.prepare(`SELECT COUNT(*) as c FROM tasks WHERE project_id = ? AND archived = 0 AND status NOT IN ('done', 'cancelled') AND due_date < ?`).get(p.id, todayStr) as { c: number }
      ).c;
      p.open_followups_count = (
        db.prepare(`SELECT COUNT(*) as c FROM followups WHERE project_id = ? AND archived = 0 AND status = 'waiting'`).get(p.id) as { c: number }
      ).c;
    }

    return NextResponse.json({ projects });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, code, client_id, description, planned_delivery_date, priority, owner_person_id } = body;

    if (!name) {
      return NextResponse.json({ error: 'Project name is required' }, { status: 400 });
    }

    const db = getDb();
    const wsId = getDefaultWorkspaceId();
    const person = owner_person_id ? db.prepare('SELECT name FROM people WHERE id = ? AND workspace_id = ? AND active = 1').get(owner_person_id, wsId) as { name: string } | undefined : undefined;
    if (owner_person_id && !person) return NextResponse.json({ error: 'Person not found' }, { status: 404 });
    const id = uuidv4();
    const now = new Date().toISOString();

    db.transaction(() => {
    db.prepare(
      `INSERT INTO projects (id, workspace_id, client_id, name, code, description, owner, owner_person_id, status, priority, planned_delivery_date, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      wsId,
      client_id || null,
      name,
      code || null,
      description || null,
      person?.name || 'Himanshu',
      owner_person_id || null,
      'green',
      priority || 'medium',
      planned_delivery_date || null,
      now,
      now
    );
    if (owner_person_id) db.prepare(`INSERT INTO project_people (project_id, person_id, role) VALUES (?, ?, 'lead')`).run(id, owner_person_id);
    })();

    const project = db.prepare(`SELECT * FROM projects WHERE id = ?`).get(id);
    return NextResponse.json({ project });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
