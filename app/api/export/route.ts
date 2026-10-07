import { NextResponse } from 'next/server';
import { getDb, getDefaultWorkspaceId } from '@/lib/db';
import { getAccess } from '@/lib/services/workspaceAccess';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const access = await getAccess(request, ['admin']);
    const db = getDb();
    const wsId = getDefaultWorkspaceId();

    const snapshot = {
      workspace: db.prepare(`SELECT * FROM workspaces WHERE id = ?`).get(wsId),
      clients: db.prepare(`SELECT * FROM clients WHERE workspace_id = ?`).all(wsId),
      people: db.prepare(`SELECT * FROM people WHERE workspace_id = ?`).all(wsId),
      teams: db.prepare(`SELECT * FROM teams WHERE workspace_id = ?`).all(wsId),
      team_memberships: db.prepare(`SELECT m.* FROM team_memberships m JOIN teams t ON t.id = m.team_id WHERE t.workspace_id = ?`).all(wsId),
      project_teams: db.prepare(`SELECT pt.* FROM project_teams pt JOIN projects p ON p.id = pt.project_id WHERE p.workspace_id = ?`).all(wsId),
      project_people: db.prepare(`SELECT pp.* FROM project_people pp JOIN projects p ON p.id = pp.project_id WHERE p.workspace_id = ?`).all(wsId),
      projects: db.prepare(`SELECT * FROM projects WHERE workspace_id = ?`).all(wsId),
      workstreams: db.prepare('SELECT w.* FROM workstreams w JOIN projects p ON p.id = w.project_id WHERE p.workspace_id = ?').all(wsId),
      deliverables: db.prepare('SELECT d.* FROM deliverables d JOIN projects p ON p.id = d.project_id WHERE p.workspace_id = ?').all(wsId),
      tasks: db.prepare(`SELECT * FROM tasks WHERE workspace_id = ?`).all(wsId),
      task_dependencies: db.prepare('SELECT d.* FROM task_dependencies d JOIN tasks t ON t.id = d.task_id WHERE t.workspace_id = ?').all(wsId),
      subtasks: db.prepare(`SELECT s.* FROM subtasks s JOIN tasks t ON s.task_id = t.id WHERE t.workspace_id = ?`).all(wsId),
      followups: db.prepare(`SELECT * FROM followups WHERE workspace_id = ?`).all(wsId),
      recurring_obligations: db.prepare(`SELECT * FROM recurring_obligations WHERE workspace_id = ?`).all(wsId),
      recurrence_instances: db.prepare(`SELECT i.* FROM recurrence_instances i JOIN recurring_obligations r ON r.id = i.obligation_id WHERE r.workspace_id = ?`).all(wsId),
      daily_focus: db.prepare(`SELECT * FROM daily_focus WHERE workspace_id = ? ORDER BY focus_date, position`).all(wsId),
      qc_templates: db.prepare(`SELECT * FROM qc_templates WHERE workspace_id = ?`).all(wsId),
      qc_items: db.prepare(`SELECT i.* FROM qc_items i LEFT JOIN qc_templates t ON t.id = i.template_id
        WHERE t.workspace_id = ? OR i.project_id IN (SELECT id FROM projects WHERE workspace_id = ?)` ).all(wsId, wsId),
      qc_checklists: db.prepare(`SELECT * FROM qc_checklists WHERE workspace_id = ?`).all(wsId),
      qc_checklist_items: db.prepare(`SELECT i.* FROM qc_checklist_items i JOIN qc_checklists c ON c.id = i.checklist_id WHERE c.workspace_id = ?`).all(wsId),
      notes: db.prepare(`SELECT * FROM notes WHERE workspace_id = ? AND (visibility = 'shared' OR owner_user_id = ?)`).all(wsId, access.user.id),
      note_links: db.prepare("SELECT l.* FROM note_links l JOIN notes n ON n.id = l.note_id WHERE n.workspace_id = ? AND (n.visibility = 'shared' OR n.owner_user_id = ?)").all(wsId, access.user.id),
      notebooks: db.prepare(`SELECT * FROM notebooks WHERE workspace_id = ? AND (visibility = 'shared' OR owner_user_id = ?)`).all(wsId, access.user.id),
      notebook_pages: db.prepare(`SELECT p.* FROM notebook_pages p JOIN notebooks n ON n.id = p.notebook_id WHERE n.workspace_id = ? AND (n.visibility = 'shared' OR n.owner_user_id = ?)`).all(wsId, access.user.id),
      notebook_revisions: db.prepare(`SELECT r.* FROM notebook_revisions r JOIN notebook_pages p ON p.id = r.page_id JOIN notebooks n ON n.id = p.notebook_id WHERE n.workspace_id = ? AND (n.visibility = 'shared' OR n.owner_user_id = ?)`).all(wsId, access.user.id),
      inbox_items: db.prepare(`SELECT * FROM inbox_items WHERE workspace_id = ?`).all(wsId),
      file_trackers: db.prepare("SELECT * FROM file_trackers WHERE workspace_id = ? AND (visibility = 'shared' OR owner_user_id = ?)").all(wsId, access.user.id),
      tracker_row_links: db.prepare("SELECT l.* FROM tracker_row_links l JOIN file_trackers t ON t.id = l.tracker_id WHERE t.workspace_id = ? AND (t.visibility = 'shared' OR t.owner_user_id = ?)").all(wsId, access.user.id),
      saved_views: db.prepare('SELECT * FROM saved_views WHERE workspace_id = ? AND user_id = ?').all(wsId, access.user.id),
      work_following: db.prepare('SELECT * FROM work_following WHERE workspace_id = ? AND user_id = ?').all(wsId, access.user.id),
      user_preferences: db.prepare('SELECT * FROM user_preferences WHERE workspace_id = ? AND user_id = ?').all(wsId, access.user.id),
      reminders: db.prepare('SELECT * FROM reminders WHERE workspace_id = ? AND (user_id IS NULL OR user_id = ?)').all(wsId, access.user.id),
      calendar_events: db.prepare('SELECT * FROM calendar_events WHERE workspace_id = ?').all(wsId),
      weekly_reviews: db.prepare('SELECT * FROM weekly_reviews WHERE workspace_id = ? AND user_id = ?').all(wsId, access.user.id),
      exported_at: new Date().toISOString(),
    };

    return new NextResponse(JSON.stringify(snapshot, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="omnitool_workspace_backup_${new Date().toISOString().split('T')[0]}.json"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
