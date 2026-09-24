import { NextResponse } from 'next/server';
import { getDb, getDefaultWorkspaceId } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import { QcTemplate, QcItem } from '@/lib/db/schema';

export async function GET() {
  try {
    const db = getDb();
    const wsId = getDefaultWorkspaceId();

    const templates = db
      .prepare(`SELECT * FROM qc_templates WHERE workspace_id = ? ORDER BY created_at DESC`)
      .all(wsId) as QcTemplate[];

    for (const t of templates) {
      t.items = db.prepare(`SELECT * FROM qc_items WHERE template_id = ? ORDER BY created_at ASC`).all(t.id) as QcItem[];
    }

    const unassignedItems = db
      .prepare(`SELECT * FROM qc_items WHERE template_id IS NULL AND (project_id IS NOT NULL OR task_id IS NOT NULL)`)
      .all() as QcItem[];

    return NextResponse.json({ templates, unassignedItems });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { title, description, items, template_id, project_id, task_id, deliverable_id } = body;
    const db = getDb();
    const wsId = getDefaultWorkspaceId();
    const now = new Date().toISOString();

    if (template_id) {
      const template = db.prepare('SELECT * FROM qc_templates WHERE id = ? AND workspace_id = ?').get(template_id, wsId) as QcTemplate | undefined;
      if (!template || !project_id) return NextResponse.json({ error: 'A template and project are required' }, { status: 400 });
      const project = db.prepare('SELECT id FROM projects WHERE id = ? AND workspace_id = ?').get(project_id, wsId);
      if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
      if (task_id && !db.prepare('SELECT id FROM tasks WHERE id = ? AND project_id = ?').get(task_id, project_id)) return NextResponse.json({ error: 'Task does not belong to project' }, { status: 400 });
      if (deliverable_id && !db.prepare('SELECT id FROM deliverables WHERE id = ? AND project_id = ?').get(deliverable_id, project_id)) return NextResponse.json({ error: 'Deliverable does not belong to project' }, { status: 400 });
      const checklistId = uuidv4();
      db.transaction(() => {
        db.prepare(`INSERT INTO qc_checklists (id, workspace_id, template_id, project_id, task_id, deliverable_id, title, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
          .run(checklistId, wsId, template_id, project_id, task_id || null, deliverable_id || null, template.title, now);
        const definitions = db.prepare('SELECT title FROM qc_items WHERE template_id = ? ORDER BY created_at ASC').all(template_id) as { title: string }[];
        for (const definition of definitions) {
          db.prepare(`INSERT INTO qc_checklist_items (id, checklist_id, title, created_at) VALUES (?, ?, ?, ?)`).run(uuidv4(), checklistId, definition.title, now);
        }
      })();
      return NextResponse.json({ checklist: db.prepare('SELECT * FROM qc_checklists WHERE id = ?').get(checklistId) });
    }

    if (!title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }

    const templateId = uuidv4();
    db.transaction(() => {
      db.prepare(`INSERT INTO qc_templates (id, workspace_id, title, description, created_at) VALUES (?, ?, ?, ?, ?)`)
        .run(templateId, wsId, title.trim(), description || null, now);
      if (Array.isArray(items)) {
        for (const itemTitle of items) {
          if (typeof itemTitle === 'string' && itemTitle.trim()) {
            db.prepare(`INSERT INTO qc_items (id, template_id, title, created_at) VALUES (?, ?, ?, ?)`)
              .run(uuidv4(), templateId, itemTitle.trim(), now);
          }
        }
      }
    })();

    const template = db.prepare(`SELECT * FROM qc_templates WHERE id = ?`).get(templateId);
    return NextResponse.json({ template });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { itemId, is_checked, notes, templateId, title, description, items } = body;
    const db = getDb();
    const wsId = getDefaultWorkspaceId();

    if (templateId) {
      if (!title?.trim() || !Array.isArray(items) || !items.every((item: unknown) => typeof item === 'string')) {
        return NextResponse.json({ error: 'Template title and item list are required' }, { status: 400 });
      }
      const existing = db.prepare('SELECT id FROM qc_templates WHERE id = ? AND workspace_id = ?').get(templateId, wsId);
      if (!existing) return NextResponse.json({ error: 'Template not found' }, { status: 404 });
      db.transaction(() => {
        db.prepare('UPDATE qc_templates SET title = ?, description = ? WHERE id = ?').run(title.trim(), description || null, templateId);
        db.prepare('DELETE FROM qc_items WHERE template_id = ?').run(templateId);
        for (const itemTitle of items) {
          if (itemTitle.trim()) db.prepare('INSERT INTO qc_items (id, template_id, title, created_at) VALUES (?, ?, ?, ?)')
            .run(uuidv4(), templateId, itemTitle.trim(), new Date().toISOString());
        }
      })();
      return NextResponse.json({ template: db.prepare('SELECT * FROM qc_templates WHERE id = ?').get(templateId) });
    }

    if (!itemId) {
      return NextResponse.json({ error: 'QC Item ID is required' }, { status: 400 });
    }

    if (is_checked === undefined && notes === undefined) return NextResponse.json({ error: 'No changes supplied' }, { status: 400 });
    const existing = db.prepare(`SELECT i.id FROM qc_checklist_items i JOIN qc_checklists c ON c.id = i.checklist_id WHERE i.id = ? AND c.workspace_id = ?`).get(itemId, wsId);
    if (!existing) return NextResponse.json({ error: 'Checklist item not found' }, { status: 404 });
    const updates: string[] = [];
    const params: any[] = [];

    if (is_checked !== undefined) {
      updates.push('is_checked = ?');
      params.push(is_checked ? 1 : 0);
    }
    if (notes !== undefined) {
      updates.push('notes = ?');
      params.push(notes);
    }

    params.push(itemId);
    db.prepare(`UPDATE qc_checklist_items SET ${updates.join(', ')} WHERE id = ?`).run(...params);

    const item = db.prepare(`SELECT * FROM qc_checklist_items WHERE id = ?`).get(itemId);
    return NextResponse.json({ item });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
