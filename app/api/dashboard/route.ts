import { NextResponse } from 'next/server';
import { getDb, getDefaultWorkspaceId } from '@/lib/db';
import { getAttentionItems, getDashboardMetrics } from '@/lib/services/attentionEngine';
import { runAttentionSweep } from '@/lib/services/notificationEngine';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    try {
      runAttentionSweep();
    } catch (err) {
      console.error('runAttentionSweep failed:', err);
    }

    const db = getDb();
    const wsId = getDefaultWorkspaceId();
    const todayStr = new Date().toISOString().split('T')[0];

    const metrics = getDashboardMetrics();
    const attentionItems = getAttentionItems();

    const todayTasks = db
      .prepare(
        `SELECT t.*, p.name as project_name FROM tasks t
         LEFT JOIN projects p ON t.project_id = p.id
         WHERE t.workspace_id = ? AND t.archived = 0 AND t.status NOT IN ('done', 'cancelled') AND t.due_date = ?
         ORDER BY CASE WHEN t.priority = 'critical' THEN 1 WHEN t.priority = 'high' THEN 2 WHEN t.priority = 'medium' THEN 3 ELSE 4 END, t.due_date ASC
         LIMIT 8`
      )
      .all(wsId, todayStr);

    const todayEvents = db
      .prepare(`SELECT * FROM calendar_events WHERE workspace_id = ? AND archived = 0 AND end_time >= strftime('%Y-%m-%dT%H:%M:%fZ', 'now') AND substr(start_time, 1, 10) = ? ORDER BY start_time ASC`)
      .all(wsId, todayStr);

    const activeFollowups = db
      .prepare(
        `SELECT f.*, p.name as project_name, CAST(julianday('now') - julianday(f.last_activity_at) AS INTEGER) as waiting_days
         FROM followups f LEFT JOIN projects p ON f.project_id = p.id
         WHERE f.workspace_id = ? AND f.archived = 0 AND f.status IN ('waiting', 'escalated')
         ORDER BY f.created_at ASC LIMIT 8`
      )
      .all(wsId);

    const recentActivity = db
      .prepare(`SELECT * FROM activity_log WHERE workspace_id = ? ORDER BY created_at DESC LIMIT 20`)
      .all(wsId);

    return NextResponse.json({ metrics, attentionItems, todayTasks, todayEvents, activeFollowups, recentActivity });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
