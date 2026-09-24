import { NextResponse } from 'next/server';
import { getDb, getDefaultWorkspaceId, getSetting, setSetting } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

export async function GET() {
  try {
    const db = getDb();
    const wsId = getDefaultWorkspaceId();
    const todayStr = new Date().toISOString().split('T')[0];
    const tomorrowDate = new Date();
    tomorrowDate.setDate(tomorrowDate.getDate() + 1);
    const tomorrowStr = tomorrowDate.toISOString().split('T')[0];

    // Tasks completed today
    const completed_today = db.prepare(
      `SELECT t.*, p.name as project_name FROM tasks t 
       LEFT JOIN projects p ON t.project_id = p.id 
       WHERE t.workspace_id = ? AND t.status = 'done' AND t.actual_completion = ?`
    ).all(wsId, todayStr);

    // Incomplete tasks (in progress, open, blocked, waiting) that were due today or earlier
    const incomplete_tasks = db.prepare(
      `SELECT t.*, p.name as project_name FROM tasks t 
       LEFT JOIN projects p ON t.project_id = p.id 
       WHERE t.workspace_id = ? AND t.status NOT IN ('done', 'cancelled') AND t.due_date <= ?`
    ).all(wsId, todayStr);

    // New inbox captures today
    const new_captures_today = db.prepare(
      `SELECT * FROM inbox_items WHERE workspace_id = ? AND created_at >= ?`
    ).all(wsId, todayStr + 'T00:00:00');

    // Pending followups with waiting days
    const pending_followups = db.prepare(
      `SELECT f.*, p.name as project_name,
       CAST(julianday('now') - julianday(f.created_at) AS INTEGER) as waiting_days
       FROM followups f 
       LEFT JOIN projects p ON f.project_id = p.id 
       WHERE f.workspace_id = ? AND f.status IN ('waiting', 'escalated')
       ORDER BY f.created_at ASC`
    ).all(wsId);

    // Tomorrow's tasks
    const tomorrow_tasks = db.prepare(
      `SELECT t.*, p.name as project_name FROM tasks t 
       LEFT JOIN projects p ON t.project_id = p.id 
       WHERE t.workspace_id = ? AND t.status NOT IN ('done', 'cancelled') AND t.due_date = ?`
    ).all(wsId, tomorrowStr);

    // Tomorrow's events
    const tomorrow_events = db.prepare(
      `SELECT * FROM calendar_events 
       WHERE workspace_id = ? AND start_time >= ? AND start_time < ?`
    ).all(wsId, tomorrowStr + 'T00:00:00', tomorrowStr + 'T23:59:59');

    const lastReviewedAt = getSetting('last_daily_review_at');
    const reviewedToday = !!lastReviewedAt && lastReviewedAt.split('T')[0] === todayStr;

    return NextResponse.json({
      completed_today,
      incomplete_tasks,
      new_captures_today,
      pending_followups,
      tomorrow_tasks,
      tomorrow_events,
      reviewed_today: reviewedToday,
      last_daily_review_at: lastReviewedAt,
      summary: {
        completed_count: (completed_today as any[]).length,
        incomplete_count: (incomplete_tasks as any[]).length,
        captures_count: (new_captures_today as any[]).length,
        followups_count: (pending_followups as any[]).length,
        tomorrow_tasks_count: (tomorrow_tasks as any[]).length,
        tomorrow_events_count: (tomorrow_events as any[]).length,
      }
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST() {
  try {
    const wsId = getDefaultWorkspaceId();
    const db = getDb();
    const now = new Date().toISOString();
    setSetting('last_daily_review_at', now);
    db.prepare(
      `INSERT INTO activity_log (id, workspace_id, entity_type, entity_id, action, details, created_at) VALUES (?, ?, 'system', ?, 'daily_review_completed', 'Daily review completed', ?)`
    ).run(uuidv4(), wsId, wsId, now);
    return NextResponse.json({ success: true, reviewed_at: now });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
