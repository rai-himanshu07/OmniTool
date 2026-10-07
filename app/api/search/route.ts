import { NextRequest, NextResponse } from 'next/server';
import { getDb, getDefaultWorkspaceId } from '@/lib/db';
import { getAccess, AccessError, apiError } from '@/lib/services/workspaceAccess';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const access = await getAccess(request);
    const searchParams = request.nextUrl.searchParams;
    const q = (searchParams.get('q') || '').trim();
    const requestedType = searchParams.get('type');
    const type = requestedType === 'inbox' ? 'inbox_item' : requestedType;
    const projectId = searchParams.get('project_id');
    const clientId = searchParams.get('client_id');
    const personId = searchParams.get('person_id');
    const status = searchParams.get('status');
    const priority = searchParams.get('priority');
    const workspaceId = getDefaultWorkspaceId();
    const db = getDb();

    if (q.length > 500) throw new AccessError('Search text is too long');
    if (!q && !projectId && !clientId && !personId && !status && !priority) {
      return NextResponse.json({ items: [], results: [] });
    }

    const likeTerm = `%${q}%`;
    const results = [];
    const constrain = (query: string, values: any[], alias: string, kind: string) => {
      query += ` AND ${alias}.archived = 0`;
      if (clientId) { query += kind === 'note' ? ' AND COALESCE(n.client_id, p.client_id) = ?' : ' AND p.client_id = ?'; values.push(clientId); }
      if (personId) { query += kind === 'task' ? ' AND t.assignee_person_id = ?' : kind === 'followup' ? ' AND f.waiting_on_person_id = ?' : ' AND p.owner_person_id = ?'; values.push(personId); }
      if (status && kind !== 'note') { query += ` AND ${alias}.status = ?`; values.push(status); }
      if (priority && kind !== 'note') { query += ` AND ${alias}.priority = ?`; values.push(priority); }
      return query + ' LIMIT 1000';
    };

    // Search tasks
    if (!type || type === 'task') {
      let query = `
        SELECT t.id, 'task' as entity_type, t.title as title, t.description as snippet, p.name as project_name
        FROM tasks t
        LEFT JOIN projects p ON t.project_id = p.id
        WHERE t.workspace_id = ? AND (t.title LIKE ? OR t.description LIKE ?)
      `;
      const params: any[] = [workspaceId, likeTerm, likeTerm];
      
      if (projectId) {
        query += ` AND t.project_id = ?`;
        params.push(projectId);
      }
      
      const tasks = db.prepare(constrain(query, params, 't', 'task')).all(...params);
      results.push(...tasks);
    }

    // Search projects
    if (!type || type === 'project') {
      let query = `
        SELECT p.id, 'project' as entity_type, p.name as title, p.description as snippet, p.name as project_name
        FROM projects p
        WHERE p.workspace_id = ? AND (p.name LIKE ? OR p.description LIKE ?)
      `;
      const params: any[] = [workspaceId, likeTerm, likeTerm];
      
      if (projectId) {
        query += ` AND p.id = ?`;
        params.push(projectId);
      }
      
      const projects = db.prepare(constrain(query, params, 'p', 'project')).all(...params);
      results.push(...projects);
    }

    // Search followups
    if (!type || type === 'followup') {
      let query = `
        SELECT f.id, 'followup' as entity_type, f.title as title, f.notes as snippet, p.name as project_name
        FROM followups f
        LEFT JOIN projects p ON f.project_id = p.id
        WHERE f.workspace_id = ? AND (f.title LIKE ? OR f.notes LIKE ?)
      `;
      const params: any[] = [workspaceId, likeTerm, likeTerm];
      
      if (projectId) {
        query += ` AND f.project_id = ?`;
        params.push(projectId);
      }
      
      const followups = db.prepare(constrain(query, params, 'f', 'followup')).all(...params);
      results.push(...followups);
    }

    // Search notes
    if ((!type || type === 'note') && !status && !priority) {
      let query = `
        SELECT n.id, 'note' as entity_type, n.title as title, n.content as snippet, p.name as project_name
        FROM notes n
        LEFT JOIN projects p ON n.project_id = p.id
        WHERE n.workspace_id = ? AND n.archived = 0 AND (n.visibility = 'shared' OR n.owner_user_id = ?) AND (n.title LIKE ? OR n.content LIKE ?)
      `;
      const params: any[] = [workspaceId, access.user.id, likeTerm, likeTerm];

      if (projectId) {
        query += ` AND n.project_id = ?`;
        params.push(projectId);
      }
      
      const notes = db.prepare(constrain(query, params, 'n', 'note')).all(...params);
      results.push(...notes);
    }

    // Search inbox_items
    if ((!type || type === 'inbox_item') && !projectId && !clientId && !personId && !priority) {
      let query = `
        SELECT i.id, 'inbox_item' as entity_type, i.content as title, i.content as snippet, NULL as project_name
        FROM inbox_items i
        WHERE i.workspace_id = ? AND i.content LIKE ?
      `;
      const params: any[] = [workspaceId, likeTerm];
      query += ' AND i.status <> ?'; params.push('archived');
      if (status) { query += ' AND i.status = ?'; params.push(status); }
      
      const inboxItems = db.prepare(query + ' LIMIT 1000').all(...params);
      results.push(...inboxItems);
    }

    if ((!type || type === 'notebook') && !projectId && !clientId && !personId && !status && !priority) {
      results.push(...db.prepare(`SELECT b.id, b.notebook_id, 'notebook' AS entity_type, b.title, substr(b.plain_text, 1, 240) AS snippet, n.name AS project_name
        FROM notebook_pages b JOIN notebooks n ON n.id = b.notebook_id WHERE n.workspace_id = ? AND n.archived = 0 AND b.archived = 0
        AND (n.visibility = 'shared' OR n.owner_user_id = ?) AND (b.title LIKE ? OR b.plain_text LIKE ?) ORDER BY b.id LIMIT 1000`).all(workspaceId, access.user.id, likeTerm, likeTerm));
    }

    // Sort by relevance (exact match on title gets higher priority)
    const exactTerm = q.toLowerCase();
    results.sort((a: any, b: any) => {
      const aTitleMatch = a.title?.toLowerCase().includes(exactTerm) ? 1 : 0;
      const bTitleMatch = b.title?.toLowerCase().includes(exactTerm) ? 1 : 0;
      
      if (aTitleMatch !== bTitleMatch) {
        return bTitleMatch - aTitleMatch;
      }
      return a.title.localeCompare(b.title) || a.id.localeCompare(b.id);
    });

    const offset = Math.max(0, Math.min(6000, Number(searchParams.get('offset')) || 0));
    const items = results.slice(offset, offset + 100).map((item: any) => ({
      ...item,
      entity_id: item.id,
      entity_type: item.entity_type === 'inbox_item' ? 'inbox' : item.entity_type,
      href: item.entity_type === 'task' ? `/tasks/${item.id}`
        : item.entity_type === 'project' ? `/projects/${item.id}`
        : item.entity_type === 'notebook' ? `/notebooks?notebook_id=${item.notebook_id}&page_id=${item.id}`
        : `/${item.entity_type === 'followup' ? 'followups' : item.entity_type === 'note' ? 'notes' : 'inbox'}?focus=${encodeURIComponent(item.id)}`,
    }));
    return NextResponse.json({ items, results: items, has_more: results.length > offset + 100, total: results.length });
  } catch (error: any) {
    return apiError(error);
  }
}
