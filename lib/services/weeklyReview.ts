import { startOfWeek, addDays, format } from 'date-fns';
import { getDb, getDefaultWorkspaceId } from '../db';

const day = (date: Date) => format(date, 'yyyy-MM-dd');

export function weekBounds() {
  const start = startOfWeek(new Date(), { weekStartsOn: 1 });
  return { start: day(start), end: day(addDays(start, 7)), nextEnd: day(addDays(start, 14)) };
}

export function getWeeklySnapshot() {
  const db = getDb();
  const wsId = getDefaultWorkspaceId();
  const week = weekBounds();
  const completed = db.prepare(`SELECT id, title, actual_completion AS date, project_id FROM tasks
    WHERE workspace_id = ? AND status = 'done' AND actual_completion >= ? AND actual_completion < ? ORDER BY actual_completion DESC LIMIT 50`)
    .all(wsId, week.start, week.end);
  const due = db.prepare(`SELECT id, title, due_date AS date, priority, project_id FROM tasks
    WHERE workspace_id = ? AND status NOT IN ('done', 'cancelled') AND due_date < ? ORDER BY due_date ASC LIMIT 50`)
    .all(wsId, week.end);
  const followups = db.prepare(`SELECT id, title, expected_date AS date, waiting_on_person FROM followups
    WHERE workspace_id = ? AND status IN ('waiting', 'escalated') ORDER BY expected_date ASC LIMIT 50`).all(wsId);
  const upcoming = db.prepare(`SELECT id, title, due_date AS date, priority, project_id FROM tasks
    WHERE workspace_id = ? AND status NOT IN ('done', 'cancelled') AND due_date >= ? AND due_date < ? ORDER BY due_date ASC LIMIT 50`)
    .all(wsId, week.end, week.nextEnd);
  const meetings = db.prepare(`SELECT id, title, start_time AS date, location FROM calendar_events
    WHERE workspace_id = ? AND start_time >= ? AND start_time < ? ORDER BY start_time ASC LIMIT 50`)
    .all(wsId, week.end, week.nextEnd);
  return { week, completed, due, followups, upcoming, meetings };
}