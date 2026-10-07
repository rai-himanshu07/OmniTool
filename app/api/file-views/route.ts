import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { AccessError, apiError, getAccess } from '@/lib/services/workspaceAccess';
import { boundedFormData } from '@/lib/services/boundedFiles';
import { parseTracker, TrackerSheet, TrackerMapping, validateMapping } from '@/lib/services/trackerFiles';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
async function visible(request: Request, id: string, write = false) {
  const access = await getAccess(request, write ? ['admin', 'member'] : ['admin', 'member', 'viewer']);
  const tracker = getDb().prepare("SELECT * FROM file_trackers WHERE id = ? AND workspace_id = ? AND (visibility = 'shared' OR owner_user_id = ?)").get(id, access.workspaceId, access.user.id) as any;
  if (!tracker) throw new AccessError('Tracker not found', 404);
  return { access, tracker };
}
export async function GET(request: Request) {
  try {
    const id = new URL(request.url).searchParams.get('id');
    if (id) { const { tracker, access } = await visible(request, id); return NextResponse.json({ tracker: { ...tracker, sheets: JSON.parse(tracker.payload_json), mapping: JSON.parse(tracker.mapping_json), payload_json: undefined, mapping_json: undefined, can_edit: tracker.owner_user_id === access.user.id }, links: getDb().prepare('SELECT * FROM tracker_row_links WHERE tracker_id = ?').all(id) }); }
    const access = await getAccess(request);
    return NextResponse.json({ trackers: getDb().prepare("SELECT id, name, visibility, file_name, imported_at FROM file_trackers WHERE workspace_id = ? AND archived = 0 AND (visibility = 'shared' OR owner_user_id = ?) ORDER BY imported_at DESC").all(access.workspaceId, access.user.id) });
  } catch (error) { return apiError(error); }
}
export async function POST(request: Request) {
  try {
    const access = await getAccess(request, ['admin', 'member']);
    if (request.headers.get('content-type')?.startsWith('multipart/form-data')) {
      const form = await boundedFormData(request, 11 * 1024 * 1024); const file = form.get('file');
      if (!(file instanceof File)) throw new AccessError('Choose a file');
      const sheets = await parseTracker(file); const id = form.get('id')?.toString(); const db = getDb();
      if (id) {
        const { tracker } = await visible(request, id, true);
        if (tracker.owner_user_id !== access.user.id) throw new AccessError('Only the tracker owner can refresh', 403);
        const old = JSON.parse(tracker.payload_json) as TrackerSheet[]; const mapping = JSON.parse(tracker.mapping_json);
        for (const name of Object.keys(mapping)) {
          const before = old.find((sheet) => sheet.name === name); const after = sheets.find((sheet) => sheet.name === name);
          if (!after || JSON.stringify(before?.headers) !== JSON.stringify(after.headers)) throw new AccessError('Mapped sheet or columns changed. Import as a new tracker to preserve existing row identities.', 409);
          validateMapping(after, mapping[name]);
        }
        db.prepare('UPDATE file_trackers SET file_name = ?, payload_json = ?, imported_at = ? WHERE id = ?').run(file.name.slice(0, 200), JSON.stringify(sheets), new Date().toISOString(), id);
        return NextResponse.json({ id, success: true });
      }
      const count = (db.prepare('SELECT COUNT(*) AS count FROM file_trackers WHERE owner_user_id = ?').get(access.user.id) as { count: number }).count;
      if (count >= 30) throw new AccessError('Maximum 30 trackers per account');
      const newId = randomUUID(); const name = form.get('name')?.toString().trim().slice(0, 160) || file.name;
      db.prepare('INSERT INTO file_trackers (id, workspace_id, owner_user_id, visibility, name, file_name, payload_json, imported_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
        .run(newId, access.workspaceId, access.user.id, form.get('visibility') === 'shared' ? 'shared' : 'private', name, file.name.slice(0, 200), JSON.stringify(sheets), new Date().toISOString());
      return NextResponse.json({ id: newId });
    }
    const body = await request.json(); const { tracker } = await visible(request, body.id, true);
    const sheet = (JSON.parse(tracker.payload_json) as TrackerSheet[]).find((entry) => entry.name === body.sheet);
    const mapping = JSON.parse(tracker.mapping_json)[body.sheet] as TrackerMapping;
    if (!sheet || !['task', 'followup'].includes(body.type) || !Array.isArray(body.rows) || !body.rows.length || body.rows.length > 100) throw new AccessError('Select 1-100 rows and an outcome type');
    validateMapping(sheet, mapping);
    const db = getDb();
    if (body.project_id && !db.prepare('SELECT id FROM projects WHERE id = ? AND workspace_id = ?').get(body.project_id, access.workspaceId)) throw new AccessError('Project not found');
    const now = new Date().toISOString();
    const outcomes = db.transaction(() => body.rows.map((index: number) => {
      if (!Number.isInteger(index) || index < 0 || index >= sheet.rows.length) throw new AccessError('Invalid row');
      const row = sheet.rows[index]; const key = row[mapping.key].trim(); const title = row[mapping.title].trim();
      if (!key || !title) throw new AccessError('Selected rows need stable IDs and titles');
      const existing = db.prepare('SELECT entity_id FROM tracker_row_links WHERE tracker_id = ? AND sheet_name = ? AND row_key = ? AND entity_type = ?').get(body.id, body.sheet, key, body.type) as { entity_id: string } | undefined;
      if (existing) return { id: existing.entity_id, existing: true };
      const date = mapping.due < 0 || !row[mapping.due].trim() ? null : row[mapping.due].trim();
      if (date && (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)))) throw new AccessError('Dates must be YYYY-MM-DD or Excel date cells');
      const id = randomUUID(); const context = `Source tracker: ${tracker.name}; sheet: ${body.sheet}; row ID: ${key}`;
      if (body.type === 'task') db.prepare('INSERT INTO tasks (id, workspace_id, project_id, title, description, owner, assignee_person_id, due_date, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(id, access.workspaceId, body.project_id || null, title.slice(0, 500), context, access.user.name, access.person_id, date, now, now);
      else {
        const waiting = mapping.waiting >= 0 ? row[mapping.waiting].trim() : '';
        if (!waiting) throw new AccessError('Map a waiting-on column for follow-ups');
        db.prepare('INSERT INTO followups (id, workspace_id, project_id, title, notes, owner, waiting_on_person, category, expected_date, created_at, last_activity_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(id, access.workspaceId, body.project_id || null, title.slice(0, 500), context, access.user.name, waiting, 'waiting_response', date, now, now);
      }
      db.prepare('INSERT INTO tracker_row_links VALUES (?, ?, ?, ?, ?)').run(body.id, body.sheet, key, body.type, id);
      return { id, existing: false };
    }))();
    return NextResponse.json({ outcomes });
  } catch (error) { return apiError(error instanceof AccessError ? error : new AccessError('Could not parse or import this file. No partial conversion was saved.')); }
}
export async function PUT(request: Request) {
  try {
    const body = await request.json(); const { tracker, access } = await visible(request, body.id, true);
    if (tracker.owner_user_id !== access.user.id) throw new AccessError('Only the owner can change this tracker', 403);
    if (body.visibility && !['private', 'shared'].includes(body.visibility)) throw new AccessError('Invalid visibility');
    const mapping = JSON.parse(tracker.mapping_json);
    if (body.mapping) {
      const sheet = (JSON.parse(tracker.payload_json) as TrackerSheet[]).find((entry) => entry.name === body.sheet);
      if (!sheet) throw new AccessError('Sheet not found'); validateMapping(sheet, body.mapping);
      if (mapping[body.sheet] && mapping[body.sheet].key !== body.mapping.key && getDb().prepare('SELECT 1 FROM tracker_row_links WHERE tracker_id = ? AND sheet_name = ? LIMIT 1').get(body.id, body.sheet)) throw new AccessError('Stable ID mapping cannot change after conversion');
      mapping[body.sheet] = body.mapping;
    }
    getDb().prepare('UPDATE file_trackers SET mapping_json = ?, visibility = COALESCE(?, visibility), archived = COALESCE(?, archived) WHERE id = ?').run(JSON.stringify(mapping), body.visibility || null, body.archived === undefined ? null : body.archived ? 1 : 0, body.id);
    return NextResponse.json({ success: true });
  } catch (error) { return apiError(error); }
}