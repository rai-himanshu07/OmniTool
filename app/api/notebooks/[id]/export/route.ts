import { NextRequest, NextResponse } from 'next/server';
import { getDb, getDefaultWorkspaceId } from '@/lib/db';
import { exportNotebookDocx } from '@/lib/services/notebookExport';

export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  try {
    const db = getDb();
    const notebook = db.prepare('SELECT name FROM notebooks WHERE id = ? AND workspace_id = ?').get(id, getDefaultWorkspaceId()) as { name: string } | undefined;
    if (!notebook) return NextResponse.json({ error: 'Notebook not found' }, { status: 404 });
    const pageId = request.nextUrl.searchParams.get('page_id');
    const pages = db.prepare(`SELECT title, section, content_json FROM notebook_pages WHERE notebook_id = ? AND (? IS NULL OR id = ?) AND (? IS NOT NULL OR archived = 0) ORDER BY section, created_at`)
      .all(id, pageId, pageId, pageId) as { title: string; section?: string; content_json: string }[];
    if (pageId && !pages.length) return NextResponse.json({ error: 'Page not found' }, { status: 404 });
    const buffer = await exportNotebookDocx(notebook.name, pages);
    const filename = `${notebook.name.replace(/[^a-zA-Z0-9_-]+/g, '-').slice(0, 64) || 'notebook'}.docx`;
    return new NextResponse(new Uint8Array(buffer), { headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="${filename}"`, 'Cache-Control': 'no-store',
    } });
  } catch { return NextResponse.json({ error: 'Could not export notebook' }, { status: 500 }); }
}