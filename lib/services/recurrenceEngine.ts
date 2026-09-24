import { getDb, getDefaultWorkspaceId } from '../db';
import { v4 as uuidv4 } from 'uuid';
import { RecurringObligation } from '../db/schema';

export function isWorkingDay(date: Date): boolean {
  return date.getUTCDay() !== 0 && date.getUTCDay() !== 6;
}

function addCalendarDays(date: Date, days: number): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + days));
}

export function addWorkingDays(startDate: Date, days: number): Date {
  let current = new Date(startDate);
  let added = 0;
  const direction = days >= 0 ? 1 : -1;
  const absDays = Math.abs(days);

  while (added < absDays) {
    current = addCalendarDays(current, direction);
    if (isWorkingDay(current)) {
      added++;
    }
  }
  return current;
}

export function getNthWorkingDayOfMonth(year: number, month: number, n: number): Date {
  let date = new Date(Date.UTC(year, month, 1));
  const targetMonth = date.getUTCMonth();
  let count = 0;

  while (date.getUTCMonth() === targetMonth) {
    if (isWorkingDay(date)) {
      count++;
      if (count === n) return date;
    }
    date = addCalendarDays(date, 1);
  }
  return date;
}

export function getLastWorkingDayOfMonth(year: number, month: number): Date {
  let date = new Date(Date.UTC(year, month + 1, 0));
  const targetMonth = date.getUTCMonth();
  while (date.getUTCMonth() === targetMonth) {
    if (isWorkingDay(date)) return date;
    date = addCalendarDays(date, -1);
  }
  return date;
}

export type RecurrenceFrequency = 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly' | 'working_days';

export function validRecurrence(frequency: string, rule: string): frequency is RecurrenceFrequency {
  if (['daily', 'weekly', 'biweekly', 'working_days'].includes(frequency)) return rule === frequency;
  if (frequency === 'yearly') {
    const match = /^month_day:(\d{2})-(\d{2})$/.exec(rule);
    return !!match && +match[1] >= 1 && +match[1] <= 12 && +match[2] >= 1 && +match[2] <= 31 &&
      new Date(Date.UTC(2024, +match[1] - 1, +match[2])).getUTCMonth() === +match[1] - 1;
  }
  if (frequency === 'monthly') {
    if (['5th_working_day', 'last_working_day'].includes(rule)) return true;
    const weekday = /^weekday:(-1|[1-4]):([0-6])$/.exec(rule);
    if (weekday) return true;
  }
  return ['monthly', 'quarterly'].includes(frequency) && /^day_of_month:([1-9]|[12]\d|3[01])$/.test(rule);
}

function dayInMonth(year: number, month: number, day: number): Date {
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, month, Math.min(day, lastDay)));
}

export function calculateNextOccurrence(
  currentDate: Date,
  frequency: RecurrenceFrequency,
  rule: string
): Date {
  const next = new Date(currentDate);

  if (frequency === 'daily') {
    return addCalendarDays(next, 1);
  }

  if (frequency === 'working_days') {
    return addWorkingDays(next, 1);
  }

  if (frequency === 'weekly') {
    return addCalendarDays(next, 7);
  }

  if (frequency === 'biweekly') {
    return addCalendarDays(next, 14);
  }

  if (frequency === 'monthly') {
    if (rule.includes('5th_working_day')) {
      return getNthWorkingDayOfMonth(next.getUTCFullYear(), next.getUTCMonth() + 1, 5);
    }
    if (rule.includes('last_working_day')) {
      return getLastWorkingDayOfMonth(next.getUTCFullYear(), next.getUTCMonth() + 1);
    }
    const weekday = /^weekday:(-1|[1-4]):([0-6])$/.exec(rule);
    if (weekday) {
      const year = new Date(Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 1)).getUTCFullYear();
      const month = (next.getUTCMonth() + 1) % 12;
      const ordinal = Number(weekday[1]);
      const day = Number(weekday[2]);
      if (ordinal === -1) {
        const last = new Date(Date.UTC(year, month + 1, 0));
        return addCalendarDays(last, -((last.getUTCDay() - day + 7) % 7));
      }
      const first = new Date(Date.UTC(year, month, 1));
      return addCalendarDays(first, (day - first.getUTCDay() + 7) % 7 + (ordinal - 1) * 7);
    }
    const anchorDay = Number(rule.match(/^day_of_month:(\d{1,2})$/)?.[1]) || next.getUTCDate();
    return dayInMonth(next.getUTCFullYear(), next.getUTCMonth() + 1, anchorDay);
  }

  if (frequency === 'quarterly') {
    const anchorDay = Number(rule.match(/^day_of_month:(\d{1,2})$/)?.[1]) || next.getUTCDate();
    return dayInMonth(next.getUTCFullYear(), next.getUTCMonth() + 3, anchorDay);
  }

  if (frequency === 'yearly') {
    const match = /^month_day:(\d{2})-(\d{2})$/.exec(rule);
    if (match) return dayInMonth(next.getUTCFullYear() + 1, Number(match[1]) - 1, Number(match[2]));
  }

  return addCalendarDays(next, 1);
}

export interface ProcessRecurrencesResult {
  processed: number;
  createdTaskIds: string[];
}

/**
 * Advances every due recurring obligation, creating one Task per missed
 * occurrence (capped at 60 catch-up iterations) so a neglected daily/weekly
 * item catches up instead of silently drifting forever. Idempotent and safe
 * to call repeatedly — this IS the "engine", invoked opportunistically from
 * dashboard/recurring/notifications GETs rather than a standalone worker.
 */
export function processRecurrences(): ProcessRecurrencesResult {
  const db = getDb();
  const wsId = getDefaultWorkspaceId();
  const todayStr = new Date().toISOString().split('T')[0];
  const now = new Date().toISOString();
  const createdTaskIds: string[] = [];

  const dueObligations = db
    .prepare(`SELECT * FROM recurring_obligations WHERE workspace_id = ? AND active = 1 AND next_due_date <= ?`)
    .all(wsId, todayStr) as RecurringObligation[];

  for (const ob of dueObligations) {
    let cursor = ob.next_due_date;
    let iterations = 0;

    while (cursor <= todayStr && iterations < 60) {
      iterations++;

      const existingInstance = db
        .prepare(`SELECT id FROM recurrence_instances WHERE obligation_id = ? AND due_date = ?`)
        .get(ob.id, cursor);

      if (!existingInstance) {
        const taskId = uuidv4();
        db.prepare(
          `INSERT INTO tasks (id, workspace_id, project_id, title, description, owner, status, priority, due_date, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, 'open', 'medium', ?, ?, ?)`
        ).run(taskId, wsId, ob.project_id || null, ob.title, ob.description || `Recurring — ${ob.recurrence_rule}`, 'Himanshu', cursor, now, now);

        db.prepare(
          `INSERT INTO recurrence_instances (id, obligation_id, due_date, status, task_id) VALUES (?, ?, ?, 'pending', ?)`
        ).run(uuidv4(), ob.id, cursor, taskId);

        db.prepare(
          `INSERT INTO activity_log (id, workspace_id, entity_type, entity_id, action, details, created_at) VALUES (?, ?, 'recurring', ?, 'occurrence_created', ?, ?)`
        ).run(uuidv4(), wsId, ob.id, `Created occurrence task for ${cursor}`, now);

        db.prepare(
          `INSERT INTO notifications (id, workspace_id, type, title, message, entity_type, entity_id, is_read, created_at) VALUES (?, ?, 'recurring_due', ?, ?, 'recurring', ?, 0, ?)`
        ).run(uuidv4(), wsId, 'Recurring work due', `${ob.title} is due`, ob.id, now);

        createdTaskIds.push(taskId);
      }

      const nextDate = calculateNextOccurrence(new Date(cursor), ob.frequency, ob.recurrence_rule);
      cursor = nextDate.toISOString().split('T')[0];
    }

    db.prepare(`UPDATE recurring_obligations SET next_due_date = ? WHERE id = ?`).run(cursor, ob.id);
  }

  return { processed: dueObligations.length, createdTaskIds };
}
