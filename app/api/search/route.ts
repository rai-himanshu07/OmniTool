import { NextRequest, NextResponse } from 'next/server';
import { getDb, getDefaultWorkspaceId } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const q = searchParams.get('q');
    const type = searchParams.get('type');
    const projectId = searchParams.get('project_id');
    const workspaceId = getDefaultWorkspaceId();
    const db = getDb();

    if (!q) {
      return NextResponse.json({ items: [] });
    }

    const likeTerm = `%${q}%`;
    const results = [];

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
      
      const tasks = db.prepare(query).all(...params);
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
      
      const projects = db.prepare(query).all(...params);
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
      
      const followups = db.prepare(query).all(...params);
      results.push(...followups);
    }

    // Search notes
    if (!type || type === 'note') {
      let query = `
        SELECT n.id, 'note' as entity_type, n.title as title, n.content as snippet, p.name as project_name
        FROM notes n
        LEFT JOIN projects p ON n.project_id = p.id
        WHERE n.workspace_id = ? AND (n.title LIKE ? OR n.content LIKE ?)
      `;
      const params: any[] = [workspaceId, likeTerm, likeTerm];
      
      if (projectId) {
        query += ` AND n.project_id = ?`;
        params.push(projectId);
      }
      
      const notes = db.prepare(query).all(...params);
      results.push(...notes);
    }

    // Search inbox_items
    if (!type || type === 'inbox_item') {
      let query = `
        SELECT i.id, 'inbox_item' as entity_type, i.content as title, i.content as snippet, NULL as project_name
        FROM inbox_items i
        WHERE i.workspace_id = ? AND i.content LIKE ?
      `;
      const params: any[] = [workspaceId, likeTerm];
      
      const inboxItems = db.prepare(query).all(...params);
      results.push(...inboxItems);
    }

    // Sort by relevance (exact match on title gets higher priority)
    const exactTerm = q.toLowerCase();
    results.sort((a: any, b: any) => {
      const aTitleMatch = a.title?.toLowerCase().includes(exactTerm) ? 1 : 0;
      const bTitleMatch = b.title?.toLowerCase().includes(exactTerm) ? 1 : 0;
      
      if (aTitleMatch !== bTitleMatch) {
        return bTitleMatch - aTitleMatch;
      }
      return 0;
    });

    return NextResponse.json({ items: results });
  } catch (error: any) {
    console.error('Search API error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
