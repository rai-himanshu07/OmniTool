import { NextResponse } from 'next/server';
import { getDb, getDefaultWorkspaceId } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import { Task, Subtask, TaskDependency } from '@/lib/db/schema';
import { getAccess } from '@/lib/services/workspaceAccess';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const filter = searchParams.get('filter'); // 'today', 'week', 'overdue', 'project'
    const projectId = searchParams.get('projectId');
    const db = getDb();
    const wsId = getDefaultWorkspaceId();
    const todayStr = new Date().toISOString().split('T')[0];

    let query = `
      SELECT t.*, p.name as project_name 
      FROM tasks t 
      LEFT JOIN projects p ON t.project_id = p.id 
      WHERE t.workspace_id = ? AND t.archived = 0
    `;
    const params: any[] = [wsId];

    if (projectId) {
      query += ` AND t.project_id = ?`;
      params.push(projectId);
    }

    if (filter === 'today') {
      query += ` AND (t.due_date = ? OR t.due_date < ?) AND t.status NOT IN ('done', 'cancelled')`;
      params.push(todayStr, todayStr);
    } else if (filter === 'overdue') {
      query += ` AND t.due_date < ? AND t.status NOT IN ('done', 'cancelled')`;
      params.push(todayStr);
    } else if (filter === 'week') {
      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);
      const nextWeekStr = nextWeek.toISOString().split('T')[0];
      query += ` AND t.due_date <= ? AND t.status NOT IN ('done', 'cancelled')`;
      params.push(nextWeekStr);
    }

    query += ` ORDER BY CASE WHEN t.priority = 'critical' THEN 1 WHEN t.priority = 'high' THEN 2 WHEN t.priority = 'medium' THEN 3 ELSE 4 END, t.due_date ASC`;

    const tasks = db.prepare(query).all(...params) as (Task & { project_name?: string })[];

    for (const t of tasks) {
      t.subtasks = db.prepare(`SELECT * FROM subtasks WHERE task_id = ? ORDER BY position ASC`).all(t.id) as Subtask[];
      t.dependencies = db
        .prepare(
          `SELECT td.*, t2.title as depends_on_title, t2.status as depends_on_status 
           FROM task_dependencies td 
           JOIN tasks t2 ON td.depends_on_task_id = t2.id 
           WHERE td.task_id = ?`
        )
        .all(t.id) as TaskDependency[];
    }

    return NextResponse.json({ tasks });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const access = await getAccess(request, ['admin', 'member']);
    const body = await request.json();
    const { title, description, project_id, owner, priority, due_date } = body;

    if (!title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }

    const db = getDb();
    const wsId = getDefaultWorkspaceId();
    const id = uuidv4();
    const now = new Date().toISOString();

    db.prepare(
      `INSERT INTO tasks (id, workspace_id, project_id, title, description, owner, status, priority, due_date, created_at, updated_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      wsId,
      project_id || null,
      title,
      description || null,
      owner || access.user.name,
      'open',
      priority || 'medium',
      due_date || null,
      now,
      now
    );

    db.prepare(
      `INSERT INTO activity_log (id, workspace_id, entity_type, entity_id, action, details, created_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(uuidv4(), wsId, 'task', id, 'task_created', `Task "${title}" created`, now);

    const task = db.prepare(`SELECT * FROM tasks WHERE id = ?`).get(id);
    return NextResponse.json({ task });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, status, priority, due_date, title, description } = body;

    if (!id) {
      return NextResponse.json({ error: 'Task ID is required' }, { status: 400 });
    }

    const db = getDb();
    const wsId = getDefaultWorkspaceId();
    const now = new Date().toISOString();

    const updates: string[] = ['updated_at = ?'];
    const params: any[] = [now];

    if (status) {
      updates.push('status = ?');
      params.push(status);
      if (status === 'done') {
        updates.push('actual_completion = ?');
        params.push(now);
      }
    }
    if (priority) {
      updates.push('priority = ?');
      params.push(priority);
    }
    if (due_date !== undefined) {
      updates.push('due_date = ?');
      params.push(due_date);
    }
    if (title) {
      updates.push('title = ?');
      params.push(title);
    }
    if (description !== undefined) {
      updates.push('description = ?');
      params.push(description);
    }

    params.push(id);
    db.prepare(`UPDATE tasks SET ${updates.join(', ')} WHERE id = ?`).run(...params);

    const task = db.prepare(`SELECT * FROM tasks WHERE id = ?`).get(id);
    return NextResponse.json({ task });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
