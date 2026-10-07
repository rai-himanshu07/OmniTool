import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { getDb } from '@/lib/db';
import { AccessError, apiError, getAccess } from '@/lib/services/workspaceAccess';
import { moveToTrash } from '@/lib/services/dataLifecycle';

export async function POST(request: Request) {
  try {
    const access = await getAccess(request, ['admin', 'member']);
    const { items, action, date, person_id, priority } = await request.json();
    if (!Array.isArray(items) || !items.length || items.length > 100 || items.some((item) => !['task', 'followup'].includes(item.type) || typeof item.id !== 'string')) throw new AccessError('Select 1-100 tasks or follow-ups');
    if (!['reschedule', 'assign', 'complete', 'cancel', 'archive', 'trash', 'follow', 'unfollow', 'priority'].includes(action)) throw new AccessError('Invalid action');
    if (action === 'reschedule' && (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)))) throw new AccessError('A valid date is required');
    if (action === 'priority' && !['critical', 'high', 'medium', 'low'].includes(priority)) throw new AccessError('Invalid priority');
    const db = getDb();
    const person = person_id ? db.prepare('SELECT name FROM people WHERE id = ? AND workspace_id = ? AND active = 1').get(person_id, access.workspaceId) as { name: string } | undefined : undefined;
    if (action === 'assign' && !person) throw new AccessError('Select an active person');
    const now = new Date().toISOString();
    const results = db.transaction(() => items.map((item: { type: string; id: string }) => {
      const table = item.type === 'task' ? 'tasks' : 'followups';
      if (!db.prepare(`SELECT id FROM ${table} WHERE id = ? AND workspace_id = ?`).get(item.id, access.workspaceId)) throw new AccessError('A selected item no longer exists. Nothing was changed.', 409);
      if (action === 'assign' && item.type !== 'task') throw new AccessError('Reassignment applies to tasks only');
      if (action === 'trash') return moveToTrash(db, item.type, item.id, access.workspaceId, access.user.id);
      if (action === 'follow') db.prepare('INSERT OR IGNORE INTO work_following VALUES (?, ?, ?, ?)').run(access.workspaceId, access.user.id, item.type, item.id);
      else if (action === 'unfollow') db.prepare('DELETE FROM work_following WHERE workspace_id = ? AND user_id = ? AND entity_type = ? AND entity_id = ?').run(access.workspaceId, access.user.id, item.type, item.id);
      else if (action === 'reschedule') db.prepare(`UPDATE ${table} SET ${item.type === 'task' ? 'due_date = ?, updated_at = ?' : 'expected_date = ?, last_activity_at = ?'} WHERE id = ?`).run(date, now, item.id);
      else if (action === 'assign') db.prepare('UPDATE tasks SET assignee_person_id = ?, owner = ?, updated_at = ? WHERE id = ?').run(person_id, person!.name, now, item.id);
      else if (action === 'archive') db.prepare(`UPDATE ${table} SET archived = 1 WHERE id = ?`).run(item.id);
      else if (action === 'priority') db.prepare(`UPDATE ${table} SET priority = ? WHERE id = ?`).run(priority, item.id);
      else if (item.type === 'task') {
        db.prepare('UPDATE tasks SET status = ?, actual_completion = ?, updated_at = ? WHERE id = ?').run(action === 'complete' ? 'done' : 'cancelled', action === 'complete' ? now : null, now, item.id);
        db.prepare('UPDATE recurrence_instances SET status = ?, completed_at = ? WHERE task_id = ?').run(action === 'complete' ? 'completed' : 'cancelled', now, item.id);
      } else db.prepare('UPDATE followups SET status = ?, resolved_at = ?, last_activity_at = ? WHERE id = ?').run(action === 'complete' ? 'resolved' : 'cancelled', now, now, item.id);
      db.prepare('INSERT INTO activity_log (id, workspace_id, entity_type, entity_id, action, details, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .run(randomUUID(), access.workspaceId, item.type, item.id, action, `Updated by ${access.user.name}`, now);
      return { success: true };
    }))();
    return NextResponse.json({ success: true, results });
  } catch (error) { return apiError(error); }
}