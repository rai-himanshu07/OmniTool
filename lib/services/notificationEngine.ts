import Database from 'better-sqlite3';
import { getDb, getDefaultWorkspaceId } from '../db';
import { v4 as uuidv4 } from 'uuid';
import { processRecurrences } from './recurrenceEngine';
import { Reminder } from '../db/schema';

function hasNotificationToday(db: Database.Database, wsId: string, type: string, entityType: string, entityId: string, todayStr: string): boolean {
  const row = db
    .prepare(
      `SELECT id FROM notifications WHERE workspace_id = ? AND type = ? AND entity_type = ? AND entity_id = ? AND substr(created_at, 1, 10) = ? LIMIT 1`
    )
    .get(wsId, type, entityType, entityId, todayStr);
  return !!row;
}

function hasNotificationEver(db: Database.Database, wsId: string, type: string, entityType: string, entityId: string): boolean {
  const row = db
    .prepare(`SELECT id FROM notifications WHERE workspace_id = ? AND type = ? AND entity_type = ? AND entity_id = ? LIMIT 1`)
    .get(wsId, type, entityType, entityId);
  return !!row;
}

function hasNotificationSince(db: Database.Database, wsId: string, type: string, entityType: string, entityId: string, since: string): boolean {
  return !!db.prepare(`SELECT id FROM notifications WHERE workspace_id = ? AND type = ? AND entity_type = ? AND entity_id = ? AND created_at >= ? LIMIT 1`)
    .get(wsId, type, entityType, entityId, since);
}

function createNotification(
  db: Database.Database,
  wsId: string,
  type: string,
  title: string,
  message: string,
  entityType: string | null,
  entityId: string | null,
  now: string,
  userId: string | null = null
) {
  db.prepare(
    `INSERT INTO notifications (id, workspace_id, type, title, message, entity_type, entity_id, is_read, created_at, user_id) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`
  ).run(uuidv4(), wsId, type, title, message, entityType, entityId, now, userId);
}

export interface AttentionSweepResult {
  recurrenceProcessed: number;
  remindersFired: number;
  notificationsCreated: number;
}

/**
 * Deterministic notification generator + reminder firing. Called
 * opportunistically from dashboard/notifications/my-work GETs instead of a
 * standalone background worker (matches the project's "no unnecessary
 * background services" principle). Idempotent: every generated notification
 * is deduped so repeated calls within the same day never spam duplicates.
 */
export function runAttentionSweep(): AttentionSweepResult {
  const db = getDb();
  const wsId = getDefaultWorkspaceId();
  const now = new Date();
  const nowIso = now.toISOString();
  const todayStr = nowIso.split('T')[0];
  let notificationsCreated = 0;

  let recurrenceProcessed = 0;
  try {
    recurrenceProcessed = processRecurrences().processed;
  } catch (err) {
    console.error('processRecurrences failed during attention sweep:', err);
  }

  // 1. Fire due custom reminders
  const dueReminders = db
    .prepare(`SELECT * FROM reminders WHERE workspace_id = ? AND is_fired = 0 AND remind_at <= ?`)
    .all(wsId, nowIso) as Reminder[];

  for (const r of dueReminders) {
    createNotification(db, wsId, 'reminder', 'Reminder', r.message || 'You have a reminder due', r.entity_type, r.entity_id, nowIso, (r as Reminder & { user_id?: string }).user_id || null);
    db.prepare(`UPDATE reminders SET is_fired = 1 WHERE id = ?`).run(r.id);
    notificationsCreated++;
  }

  // 2. Overdue tasks (once per task, not every morning)
  const overdueTasks = db
    .prepare(
      `SELECT id, title FROM tasks WHERE workspace_id = ? AND archived = 0 AND status NOT IN ('done', 'cancelled') AND due_date IS NOT NULL AND due_date < ?`
    )
    .all(wsId, todayStr) as { id: string; title: string }[];
  for (const t of overdueTasks) {
    if (!hasNotificationEver(db, wsId, 'overdue', 'task', t.id)) {
      createNotification(db, wsId, 'overdue', 'Task overdue', `"${t.title}" is overdue`, 'task', t.id, nowIso);
      notificationsCreated++;
    }
  }

  // 3. Due-today tasks
  const dueTodayTasks = db
    .prepare(`SELECT id, title FROM tasks WHERE workspace_id = ? AND archived = 0 AND status NOT IN ('done', 'cancelled') AND due_date = ?`)
    .all(wsId, todayStr) as { id: string; title: string }[];
  for (const t of dueTodayTasks) {
    if (!hasNotificationToday(db, wsId, 'due_soon', 'task', t.id, todayStr)) {
      createNotification(db, wsId, 'due_soon', 'Task due today', `"${t.title}" is due today`, 'task', t.id, nowIso);
      notificationsCreated++;
    }
  }

  // 4. Stalled follow-ups (once per waiting episode)
  const stalled = db
    .prepare(
      `SELECT id, title, waiting_on_person, last_activity_at FROM followups WHERE workspace_id = ? AND archived = 0 AND status = 'waiting' AND julianday(?) - julianday(last_activity_at) >= 2`
    )
    .all(wsId, nowIso) as { id: string; title: string; waiting_on_person: string; last_activity_at: string }[];
  for (const f of stalled) {
    if (!hasNotificationSince(db, wsId, 'followup_aging', 'followup', f.id, f.last_activity_at)) {
      createNotification(db, wsId, 'followup_aging', 'Follow-up waiting', `${f.waiting_on_person} — ${f.title}`, 'followup', f.id, nowIso);
      notificationsCreated++;
    }
  }

  return { recurrenceProcessed, remindersFired: dueReminders.length, notificationsCreated };
}
