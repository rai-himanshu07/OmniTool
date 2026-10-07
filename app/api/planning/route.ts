import { NextResponse } from 'next/server';
import { formatInTimeZone } from 'date-fns-tz';
import { getDb } from '@/lib/db';
import { AccessError, getAccess, apiError } from '@/lib/services/workspaceAccess';
import { preferences } from '@/lib/services/userPreferences';
import { calculateCapacity, unblockRadar, PlanningTask, PlanningDependency } from '@/lib/services/workPlanning';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  try {
    const access = await getAccess(request); const prefs = preferences(access.workspaceId, access.user.id); const params = new URL(request.url).searchParams;
    const date = params.get('date') || formatInTimeZone(new Date(), prefs.timezone, 'yyyy-MM-dd');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date) throw new AccessError('Invalid date');
    const db = getDb();
    const tasks = db.prepare("SELECT t.*, p.name AS project_name, p.planned_delivery_date FROM tasks t LEFT JOIN projects p ON p.id = t.project_id WHERE t.workspace_id = ? AND t.status NOT IN ('done', 'cancelled') ORDER BY t.updated_at DESC LIMIT 2001").all(access.workspaceId) as PlanningTask[];
    if (tasks.length > 2000) throw new AccessError('Planning supports up to 2000 unfinished tasks, including archived prerequisites. Complete or cancel obsolete commitments first.');
    const dependencies = db.prepare("SELECT d.* FROM task_dependencies d JOIN tasks t ON t.id = d.task_id WHERE t.workspace_id = ? AND t.status NOT IN ('done', 'cancelled') AND d.dependency_type = 'blocking'").all(access.workspaceId) as PlanningDependency[];
    const impact = unblockRadar(tasks, dependencies, params.get('complete') || undefined);
    const skeleton = calculateCapacity(date, prefs.timezone, prefs.work_start, prefs.work_end, prefs.daily_minutes, prefs.weekend_days, []);
    const events = db.prepare('SELECT * FROM calendar_events WHERE workspace_id = ? AND archived = 0 AND end_time > ? AND start_time < ? ORDER BY start_time').all(access.workspaceId, skeleton.start, skeleton.end) as { start_time: string; end_time: string; is_all_day: number; title: string; id: string }[];
    const capacity = calculateCapacity(date, prefs.timezone, prefs.work_start, prefs.work_end, prefs.daily_minutes, prefs.weekend_days, events, date === formatInTimeZone(new Date(), prefs.timezone, 'yyyy-MM-dd') ? Date.now() : undefined);
    const mineIds = new Set((db.prepare("SELECT id FROM tasks WHERE workspace_id = ? AND archived = 0 AND status NOT IN ('done', 'cancelled') AND ((assignee_person_id IS NOT NULL AND assignee_person_id = ?) OR (assignee_person_id IS NULL AND lower(owner) = lower(?)))").all(access.workspaceId, access.person_id, access.user.name) as { id: string }[]).map((task) => task.id));
    const mine = impact.radar.filter((task) => mineIds.has(task.id) && task.due_date && task.due_date <= date);
    const workload = mine.reduce((sum, task) => sum + task.estimated_minutes, 0);
    const priorities: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
    const candidates = impact.radar.filter((task) => mineIds.has(task.id) && task.ready && (!task.due_date || task.due_date <= date)).sort((first, second) => (priorities[first.priority] ?? 2) - (priorities[second.priority] ?? 2) || second.impact_count - first.impact_count);
    let budget = capacity.available_minutes; const blocks = capacity.free_blocks.map((block) => ({ cursor: Date.parse(block.start), end: Date.parse(block.end) }));
    const suggestions = [];
    for (const task of candidates) {
      if (suggestions.length >= 8 || task.estimated_minutes > budget) continue;
      const block = blocks.find((entry) => (entry.end - entry.cursor) / 60000 >= task.estimated_minutes);
      if (!block) continue;
      const start = new Date(block.cursor).toISOString(); block.cursor += task.estimated_minutes * 60000; budget -= task.estimated_minutes;
      suggestions.push({ ...task, start, end: new Date(block.cursor).toISOString() });
    }
    return NextResponse.json({ date, timezone: prefs.timezone, capacity, events, workload_minutes: workload, overload_minutes: Math.max(0, workload - capacity.available_minutes), mine, suggestions, radar: impact.radar.filter((task) => task.impact_count > 0).slice(0, 30), newly_ready: impact.newly_ready, simulation: !!params.get('complete') });
  } catch (error) { return apiError(error); }
}