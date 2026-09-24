import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { format } from 'date-fns';
import { getDb, getDefaultWorkspaceId } from '@/lib/db';
import type { FocusItem } from '@/lib/db/schema';

export const dynamic = 'force-dynamic';

const validDate = (value: unknown): value is string =>
  typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  Number.isFinite(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;

type Candidate = { entity_type: 'task' | 'followup'; entity_id: string; title: string; project_name: string | null; due_date: string | null; status: string };

function activeEntity(db: ReturnType<typeof getDb>, workspaceId: string, type: string, id: string): Candidate | undefined {
  if (type === 'task') return db.prepare(`SELECT 'task' AS entity_type, t.id AS entity_id, t.title, p.name AS project_name,
    t.due_date, t.status FROM tasks t LEFT JOIN projects p ON p.id = t.project_id
    WHERE t.id = ? AND t.workspace_id = ? AND t.status NOT IN ('done', 'cancelled')`).get(id, workspaceId) as Candidate | undefined;
  if (type === 'followup') return db.prepare(`SELECT 'followup' AS entity_type, f.id AS entity_id, f.title, p.name AS project_name,
    f.expected_date AS due_date, f.status FROM followups f LEFT JOIN projects p ON p.id = f.project_id
    WHERE f.id = ? AND f.workspace_id = ? AND f.status IN ('waiting', 'escalated')`).get(id, workspaceId) as Candidate | undefined;
  return undefined;
}

const itemsSql = `SELECT f.*, COALESCE(t.title, u.title, 'Unavailable item') AS title,
  COALESCE(p.name, '') AS project_name, COALESCE(t.status, u.status, 'missing') AS entity_status
  FROM daily_focus f
  LEFT JOIN tasks t ON f.entity_type = 'task' AND t.id = f.entity_id
  LEFT JOIN followups u ON f.entity_type = 'followup' AND u.id = f.entity_id
  LEFT JOIN projects p ON p.id = COALESCE(t.project_id, u.project_id)
  WHERE f.workspace_id = ? AND f.focus_date = ? ORDER BY CASE f.state WHEN 'active' THEN 0 ELSE 1 END, f.position, f.created_at`;

function compactPositions(db: ReturnType<typeof getDb>, workspaceId: string, date: string, now: string) {
  const active = db.prepare(`SELECT id, position FROM daily_focus WHERE workspace_id = ? AND focus_date = ? AND state = 'active' ORDER BY position, created_at`)
    .all(workspaceId, date) as { id: string; position: number }[];
  active.forEach((item, index) => {
    if (item.position !== index + 1) db.prepare('UPDATE daily_focus SET position = ?, updated_at = ? WHERE id = ?').run(index + 1, now, item.id);
  });
}

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const date = params.get('date') || format(new Date(), 'yyyy-MM-dd');
    if (!validDate(date)) return NextResponse.json({ error: 'Invalid focus date' }, { status: 400 });
    const db = getDb();
    const workspaceId = getDefaultWorkspaceId();
    db.transaction(() => {
      const now = new Date().toISOString();
      db.prepare(`UPDATE daily_focus SET state = 'completed', updated_at = ? WHERE workspace_id = ? AND focus_date = ? AND state = 'active'
        AND ((entity_type = 'task' AND EXISTS (SELECT 1 FROM tasks WHERE id = daily_focus.entity_id AND status = 'done'))
          OR (entity_type = 'followup' AND EXISTS (SELECT 1 FROM followups WHERE id = daily_focus.entity_id AND status = 'resolved')))`)
        .run(now, workspaceId, date);
      compactPositions(db, workspaceId, date, now);
    })();
    const items = db.prepare(itemsSql).all(workspaceId, date) as FocusItem[];
    const carryover = db.prepare(`SELECT f.id, f.focus_date, f.entity_type, f.entity_id, f.next_action,
        COALESCE(t.title, u.title) AS title, p.name AS project_name
      FROM daily_focus f
      LEFT JOIN tasks t ON f.entity_type = 'task' AND t.id = f.entity_id
      LEFT JOIN followups u ON f.entity_type = 'followup' AND u.id = f.entity_id
      LEFT JOIN projects p ON p.id = COALESCE(t.project_id, u.project_id)
      WHERE f.workspace_id = ? AND f.focus_date < ? AND f.state = 'active'
        AND ((t.id IS NOT NULL AND t.status NOT IN ('done', 'cancelled')) OR (u.id IS NOT NULL AND u.status IN ('waiting', 'escalated')))
        AND NOT EXISTS (SELECT 1 FROM daily_focus later WHERE later.workspace_id = f.workspace_id
          AND later.entity_type = f.entity_type AND later.entity_id = f.entity_id AND later.focus_date > f.focus_date AND later.focus_date <= ?)
      ORDER BY f.focus_date DESC, f.position LIMIT 8`).all(workspaceId, date, date);

    const query = (params.get('q') || '').trim().slice(0, 100);
    const term = `%${query}%`;
    const candidates = db.prepare(`SELECT * FROM (
      SELECT 'task' AS entity_type, t.id AS entity_id, t.title, p.name AS project_name, t.due_date, t.status,
        CASE WHEN t.due_date < ? THEN 0 WHEN t.due_date = ? THEN 1 ELSE 2 END AS rank
      FROM tasks t LEFT JOIN projects p ON p.id = t.project_id
      WHERE t.workspace_id = ? AND t.status NOT IN ('done', 'cancelled') AND (? = '' OR t.title LIKE ? OR p.name LIKE ?)
      UNION ALL
      SELECT 'followup', f.id, f.title, p.name, f.expected_date, f.status,
        CASE WHEN f.expected_date < ? THEN 0 WHEN f.expected_date = ? THEN 1 ELSE 2 END
      FROM followups f LEFT JOIN projects p ON p.id = f.project_id
      WHERE f.workspace_id = ? AND f.status IN ('waiting', 'escalated') AND (? = '' OR f.title LIKE ? OR p.name LIKE ?)
    ) ORDER BY rank, due_date IS NULL, due_date, title LIMIT 40`)
      .all(date, date, workspaceId, query, term, term, date, date, workspaceId, query, term, term) as Candidate[];
    return NextResponse.json({ date, items, carryover, candidates });
  } catch { return NextResponse.json({ error: 'Could not load focus plan' }, { status: 500 }); }
}

export async function POST(request: Request) {
  try {
    const { date, entity_type, entity_id, next_action = '', source_focus_id } = await request.json();
    if (!validDate(date) || !['task', 'followup'].includes(entity_type) || typeof entity_id !== 'string' || !entity_id ||
        typeof next_action !== 'string' || next_action.length > 300) return NextResponse.json({ error: 'Invalid focus item' }, { status: 400 });
    const db = getDb();
    const workspaceId = getDefaultWorkspaceId();
    if (!activeEntity(db, workspaceId, entity_type, entity_id)) return NextResponse.json({ error: 'Work item is no longer active' }, { status: 409 });
    const prior = source_focus_id ? db.prepare(`SELECT * FROM daily_focus WHERE id = ? AND workspace_id = ? AND focus_date < ? AND state = 'active'`)
      .get(source_focus_id, workspaceId, date) as FocusItem | undefined : undefined;
    if (source_focus_id && (!prior || prior.entity_type !== entity_type || prior.entity_id !== entity_id)) return NextResponse.json({ error: 'Carryover item not found' }, { status: 404 });
    const result = db.transaction(() => {
      const now = new Date().toISOString();
      compactPositions(db, workspaceId, date, now);
      const count = (db.prepare(`SELECT COUNT(*) AS n FROM daily_focus WHERE workspace_id = ? AND focus_date = ? AND state = 'active'`).get(workspaceId, date) as { n: number }).n;
      if (count >= 3) return 'full';
      const existing = db.prepare(`SELECT id, state FROM daily_focus WHERE workspace_id = ? AND focus_date = ? AND entity_type = ? AND entity_id = ?`)
        .get(workspaceId, date, entity_type, entity_id) as { id: string; state: string } | undefined;
      if (existing && existing.state !== 'removed') return 'exists';
      if (existing) db.prepare(`UPDATE daily_focus SET state = 'active', next_action = ?, position = ?, updated_at = ? WHERE id = ?`)
        .run(next_action.trim() || prior?.next_action || '', count + 1, now, existing.id);
      else db.prepare(`INSERT INTO daily_focus (id, workspace_id, focus_date, entity_type, entity_id, position, next_action, state, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)`)
        .run(uuidv4(), workspaceId, date, entity_type, entity_id, count + 1, next_action.trim() || prior?.next_action || '', now, now);
      if (prior) db.prepare(`UPDATE daily_focus SET state = 'carried', updated_at = ? WHERE id = ?`).run(now, prior.id);
      return 'added';
    })();
    if (result !== 'added') return NextResponse.json({ error: result === 'full' ? 'Choose at most three focus items' : 'Already in this plan' }, { status: 409 });
    return NextResponse.json({ success: true }, { status: 201 });
  } catch { return NextResponse.json({ error: 'Could not add focus item' }, { status: 500 }); }
}

export async function PUT(request: Request) {
  try {
    const { id, next_action, position, complete_entity } = await request.json();
    const db = getDb();
    const workspaceId = getDefaultWorkspaceId();
    const item = db.prepare(`SELECT * FROM daily_focus WHERE id = ? AND workspace_id = ? AND state = 'active'`).get(id, workspaceId) as FocusItem | undefined;
    if (!item) return NextResponse.json({ error: 'Active focus item not found' }, { status: 404 });
    if (next_action !== undefined && (typeof next_action !== 'string' || next_action.length > 300) ||
        position !== undefined && (!Number.isInteger(position) || position < 1 || position > 3) ||
        complete_entity !== undefined && complete_entity !== true ||
        next_action === undefined && position === undefined && !complete_entity) return NextResponse.json({ error: 'Invalid focus update' }, { status: 400 });
    if (complete_entity && !activeEntity(db, workspaceId, item.entity_type, item.entity_id)) return NextResponse.json({ error: 'Work item is no longer active. Refresh the plan.' }, { status: 409 });
    const activeCount = (db.prepare(`SELECT COUNT(*) AS n FROM daily_focus WHERE workspace_id = ? AND focus_date = ? AND state = 'active'`).get(workspaceId, item.focus_date) as { n: number }).n;
    if (position !== undefined && position > activeCount) return NextResponse.json({ error: 'Focus position is unavailable' }, { status: 400 });
    const now = new Date().toISOString();
    db.transaction(() => {
      if (position !== undefined && position !== item.position) {
        db.prepare(`UPDATE daily_focus SET position = ?, updated_at = ? WHERE workspace_id = ? AND focus_date = ? AND state = 'active' AND position = ?`)
          .run(item.position, now, workspaceId, item.focus_date, position);
        db.prepare('UPDATE daily_focus SET position = ?, updated_at = ? WHERE id = ?').run(position, now, item.id);
      }
      if (next_action !== undefined) db.prepare('UPDATE daily_focus SET next_action = ?, updated_at = ? WHERE id = ?').run(next_action.trim(), now, id);
      if (complete_entity) {
        if (item.entity_type === 'task') {
          db.prepare(`UPDATE tasks SET status = 'done', actual_completion = ?, updated_at = ? WHERE id = ? AND workspace_id = ?`).run(now, now, item.entity_id, workspaceId);
          db.prepare(`UPDATE recurrence_instances SET status = 'completed', completed_at = ? WHERE task_id = ?`).run(now, item.entity_id);
        } else db.prepare(`UPDATE followups SET status = 'resolved', resolved_at = ?, last_activity_at = ? WHERE id = ? AND workspace_id = ?`)
          .run(now, now, item.entity_id, workspaceId);
        db.prepare(`UPDATE daily_focus SET state = 'completed', updated_at = ? WHERE id = ?`).run(now, id);
        db.prepare(`INSERT INTO activity_log (id, workspace_id, entity_type, entity_id, action, details, created_at)
          VALUES (?, ?, ?, ?, 'focus_completed', 'Completed from Focus Plan', ?)`).run(uuidv4(), workspaceId, item.entity_type, item.entity_id, now);
        compactPositions(db, workspaceId, item.focus_date, now);
      }
    })();
    return NextResponse.json({ success: true });
  } catch { return NextResponse.json({ error: 'Could not update focus item' }, { status: 500 }); }
}

export async function DELETE(request: Request) {
  const id = new URL(request.url).searchParams.get('id');
  const db = getDb();
  const workspaceId = getDefaultWorkspaceId();
  const result = db.transaction(() => {
    const item = db.prepare(`SELECT focus_date FROM daily_focus WHERE id = ? AND workspace_id = ? AND state = 'active'`).get(id, workspaceId) as { focus_date: string } | undefined;
    if (!item) return false;
    const now = new Date().toISOString();
    db.prepare(`UPDATE daily_focus SET state = 'removed', updated_at = ? WHERE id = ?`).run(now, id);
    compactPositions(db, workspaceId, item.focus_date, now);
    return true;
  })();
  return result ? NextResponse.json({ success: true }) : NextResponse.json({ error: 'Active focus item not found' }, { status: 404 });
}