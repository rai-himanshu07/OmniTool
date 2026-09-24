import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getDb, getDefaultWorkspaceId } from '@/lib/db';
import { parseNotebookContent } from '@/lib/services/notebookContent';
import type { NotebookPage } from '@/lib/db/schema';

type PageContext = { params: Promise<{ id: string; pageId: string }> };

export async function GET(request: NextRequest, props: PageContext) {
  const { id, pageId } = await props.params;
  const db = getDb();
  const page = db.prepare(`SELECT p.* FROM notebook_pages p JOIN notebooks n ON n.id = p.notebook_id
    WHERE p.id = ? AND n.id = ? AND n.workspace_id = ?`).get(pageId, id, getDefaultWorkspaceId());
  if (!page) return NextResponse.json({ error: 'Page not found' }, { status: 404 });
  const revisions = db.prepare('SELECT id, title, saved_at FROM notebook_revisions WHERE page_id = ? ORDER BY saved_at DESC LIMIT 25').all(pageId);
  return NextResponse.json({ page, revisions });
}

export async function PUT(request: NextRequest, props: PageContext) {
  const { id, pageId } = await props.params;
  try {
    const body = await request.json();
    const db = getDb();
    const existing = db.prepare(`SELECT p.* FROM notebook_pages p JOIN notebooks n ON n.id = p.notebook_id
      WHERE p.id = ? AND n.id = ? AND n.workspace_id = ?`).get(pageId, id, getDefaultWorkspaceId()) as NotebookPage | undefined;
    if (!existing) return NextResponse.json({ error: 'Page not found' }, { status: 404 });
    if (body.if_match_updated_at && existing.updated_at !== body.if_match_updated_at) return NextResponse.json({ error: 'This page changed in another tab. Reload before saving.' }, { status: 409 });
    if (body.archived !== undefined && body.archived !== 0 && body.archived !== 1) return NextResponse.json({ error: 'Invalid archive state' }, { status: 400 });

    let title = body.title === undefined ? existing.title : body.title;
    let content = body.content === undefined ? JSON.parse(existing.content_json) : body.content;
    if (body.restore_revision_id) {
      const revision = db.prepare('SELECT title, content_json FROM notebook_revisions WHERE id = ? AND page_id = ?').get(body.restore_revision_id, pageId) as { title: string; content_json: string } | undefined;
      if (!revision) return NextResponse.json({ error: 'Revision not found' }, { status: 404 });
      title = revision.title;
      content = JSON.parse(revision.content_json);
    }
    const section = body.section === undefined ? existing.section : body.section;
    const parsed = parseNotebookContent(content);
    if (typeof title !== 'string' || !title.trim() || title.trim().length > 200 ||
        section !== null && section !== undefined && (typeof section !== 'string' || section.length > 120) || !parsed) return NextResponse.json({ error: 'Invalid page content' }, { status: 400 });

    const changed = title.trim() !== existing.title || parsed.json !== existing.content_json || (section || '') !== (existing.section || '');
    if (!changed && body.archived === undefined) return NextResponse.json({ page: existing });
    const now = new Date().toISOString();
    db.transaction(() => {
      if (changed) db.prepare('INSERT INTO notebook_revisions (id, page_id, title, content_json, saved_at) VALUES (?, ?, ?, ?, ?)')
        .run(uuidv4(), pageId, existing.title, existing.content_json, now);
      db.prepare(`UPDATE notebook_pages SET title = ?, section = ?, content_json = ?, plain_text = ?, archived = COALESCE(?, archived), updated_at = ? WHERE id = ?`)
        .run(title.trim(), section?.trim() || null, parsed.json, parsed.text, body.archived ?? null, now, pageId);
      db.prepare('UPDATE notebooks SET updated_at = ? WHERE id = ?').run(now, id);
    })();
    return NextResponse.json({ page: db.prepare('SELECT * FROM notebook_pages WHERE id = ?').get(pageId) });
  } catch { return NextResponse.json({ error: 'Could not save page' }, { status: 500 }); }
}