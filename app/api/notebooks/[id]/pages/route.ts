import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getDb, getDefaultWorkspaceId } from '@/lib/db';
import { EMPTY_DOCUMENT, parseNotebookContent } from '@/lib/services/notebookContent';

export async function POST(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const { id: notebookId } = await props.params;
  try {
    const { title, section, content = EMPTY_DOCUMENT } = await request.json();
    const db = getDb();
    const workspaceId = getDefaultWorkspaceId();
    if (!db.prepare('SELECT id FROM notebooks WHERE id = ? AND workspace_id = ? AND archived = 0').get(notebookId, workspaceId)) return NextResponse.json({ error: 'Notebook not found' }, { status: 404 });
    const parsed = parseNotebookContent(content);
    if (typeof title !== 'string' || !title.trim() || title.trim().length > 200 || !parsed || section !== undefined && (typeof section !== 'string' || section.length > 120)) return NextResponse.json({ error: 'Invalid page content' }, { status: 400 });
    const id = uuidv4();
    const now = new Date().toISOString();
    db.transaction(() => {
      db.prepare(`INSERT INTO notebook_pages (id, notebook_id, title, section, content_json, plain_text, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(id, notebookId, title.trim(), section?.trim() || null, parsed.json, parsed.text, now, now);
      db.prepare('UPDATE notebooks SET updated_at = ? WHERE id = ?').run(now, notebookId);
    })();
    return NextResponse.json({ page: db.prepare('SELECT * FROM notebook_pages WHERE id = ?').get(id) }, { status: 201 });
  } catch { return NextResponse.json({ error: 'Could not create page' }, { status: 500 }); }
}