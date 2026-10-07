import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { AccessError, getAccess, apiError } from '@/lib/services/workspaceAccess';
export async function POST(request: Request) {
  try {
    const access = await getAccess(request, ['admin', 'member']);
    const body = await request.json();
    const event = getDb().prepare('SELECT * FROM calendar_events WHERE id = ? AND workspace_id = ?').get(body.event_id, access.workspaceId) as { title: string; related_project_id: string | null; start_time: string; external_link: string | null } | undefined;
    if (!event) throw new AccessError('Meeting not found', 404);
    if (!['note', 'task', 'followup'].includes(body.type) || typeof body.title !== 'string' || !body.title.trim() || body.title.length > 500) throw new AccessError('Select an outcome type and title');
    if (body.date && (!/^\d{4}-\d{2}-\d{2}$/.test(body.date) || !Number.isFinite(Date.parse(body.date)))) throw new AccessError('Invalid date');
    if (body.type === 'followup' && !body.waiting_on?.trim()) throw new AccessError('Who are you waiting on?');
    const id = randomUUID(); const now = new Date().toISOString(); const db = getDb();
    const provenance = `Source meeting: ${event.title}\nWhen: ${event.start_time}${event.external_link ? `\nExternal meeting: ${event.external_link}` : ''}`;
    const content = [typeof body.content === 'string' ? body.content.trim() : '', provenance].filter(Boolean).join('\n\n');
    db.transaction(() => {
      if (body.type === 'note') {
        db.prepare('INSERT INTO notes (id, workspace_id, project_id, title, content, created_at, updated_at, owner_user_id, visibility) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
          .run(id, access.workspaceId, event.related_project_id, body.title.trim(), content, now, now, access.user.id, body.visibility === 'shared' ? 'shared' : 'private');
        db.prepare('INSERT INTO note_links (id, note_id, linked_entity_type, linked_entity_id, created_at) VALUES (?, ?, ?, ?, ?)').run(randomUUID(), id, 'meeting', body.event_id, now);
      } else if (body.type === 'task') db.prepare('INSERT INTO tasks (id, workspace_id, project_id, title, description, owner, assignee_person_id, due_date, created_at, updated_at, source_event_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .run(id, access.workspaceId, event.related_project_id, body.title.trim(), content, access.user.name, access.person_id, body.date || null, now, now, body.event_id);
      else db.prepare('INSERT INTO followups (id, workspace_id, project_id, title, notes, owner, waiting_on_person, category, expected_date, created_at, last_activity_at, source_event_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .run(id, access.workspaceId, event.related_project_id, body.title.trim(), content, access.user.name, body.waiting_on.trim(), 'waiting_response', body.date || null, now, now, body.event_id);
      if (body.type !== 'note' || body.visibility === 'shared') db.prepare('INSERT INTO activity_log (id, workspace_id, entity_type, entity_id, action, details, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(randomUUID(), access.workspaceId, body.type, id, 'meeting_outcome', 'Created from meeting', now);
    })();
    return NextResponse.json({ id, href: body.type === 'task' ? `/tasks/${id}` : body.type === 'note' ? `/notes?focus=${id}` : `/followups?focus=${id}` });
  } catch (error) { return apiError(error); }
}