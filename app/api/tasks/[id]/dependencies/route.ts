import { NextRequest, NextResponse } from 'next/server';
import { getDb, getDefaultWorkspaceId } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

export async function POST(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const db = getDb();
    const wsId = getDefaultWorkspaceId();
    const body = await request.json();
    const { depends_on_task_id, dependency_type } = body;

    if (!depends_on_task_id) {
      return NextResponse.json({ error: 'depends_on_task_id is required' }, { status: 400 });
    }
    if (depends_on_task_id === params.id) {
      return NextResponse.json({ error: 'A task cannot depend on itself' }, { status: 400 });
    }
    const taskCount = (db.prepare('SELECT COUNT(*) AS count FROM tasks WHERE id IN (?, ?) AND workspace_id = ? AND archived = 0').get(params.id, depends_on_task_id, wsId) as { count: number }).count;
    if (taskCount !== 2) return NextResponse.json({ error: 'Active workspace tasks are required' }, { status: 404 });
    if (dependency_type && !['blocking', 'related'].includes(dependency_type)) return NextResponse.json({ error: 'Invalid dependency type' }, { status: 400 });
    if (dependency_type !== 'related' && db.prepare(`WITH RECURSIVE chain(id) AS (SELECT ? UNION SELECT d.depends_on_task_id FROM task_dependencies d JOIN chain ON d.task_id = chain.id WHERE d.dependency_type = 'blocking') SELECT id FROM chain WHERE id = ?`).get(depends_on_task_id, params.id)) return NextResponse.json({ error: 'This dependency would create a cycle' }, { status: 409 });

    const existing = db
      .prepare(`SELECT id FROM task_dependencies WHERE task_id = ? AND depends_on_task_id = ?`)
      .get(params.id, depends_on_task_id);
    if (existing) {
      return NextResponse.json({ dependency: existing });
    }

    const id = uuidv4();
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO task_dependencies (id, task_id, depends_on_task_id, dependency_type, created_at) VALUES (?, ?, ?, ?, ?)`
    ).run(id, params.id, depends_on_task_id, dependency_type || 'blocking', now);

    db.prepare(
      `INSERT INTO activity_log (id, workspace_id, entity_type, entity_id, action, details, created_at) VALUES (?, ?, 'task', ?, 'dependency_added', 'Dependency added', ?)`
    ).run(uuidv4(), wsId, params.id, now);

    return NextResponse.json({ dependency: { id, task_id: params.id, depends_on_task_id, dependency_type: dependency_type || 'blocking', created_at: now } });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const db = getDb();
    const dependencyId = request.nextUrl.searchParams.get('dependency_id');
    if (!dependencyId) return NextResponse.json({ error: 'dependency_id query param is required' }, { status: 400 });
    db.prepare(`DELETE FROM task_dependencies WHERE id = ? AND task_id = ?`).run(dependencyId, params.id);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
