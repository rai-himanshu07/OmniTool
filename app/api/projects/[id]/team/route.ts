import { NextRequest, NextResponse } from 'next/server';
import { getDb, getDefaultWorkspaceId } from '@/lib/db';

export async function POST(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await props.params;
  try {
    const { team_id, person_id, role } = await request.json();
    const db = getDb();
    const workspaceId = getDefaultWorkspaceId();
    if (!db.prepare('SELECT id FROM projects WHERE id = ? AND workspace_id = ?').get(projectId, workspaceId)) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    if (!!team_id === !!person_id || role && !['lead', 'member'].includes(role)) return NextResponse.json({ error: 'Select one team or person' }, { status: 400 });
    if (team_id) {
      if (!db.prepare('SELECT id FROM teams WHERE id = ? AND workspace_id = ? AND active = 1').get(team_id, workspaceId)) return NextResponse.json({ error: 'Team not found' }, { status: 404 });
      db.prepare('INSERT OR IGNORE INTO project_teams (project_id, team_id) VALUES (?, ?)').run(projectId, team_id);
    } else {
      if (!db.prepare('SELECT id FROM people WHERE id = ? AND workspace_id = ? AND active = 1').get(person_id, workspaceId)) return NextResponse.json({ error: 'Person not found' }, { status: 404 });
      db.prepare(`INSERT INTO project_people (project_id, person_id, role) VALUES (?, ?, ?)
        ON CONFLICT(project_id, person_id) DO UPDATE SET role = excluded.role`).run(projectId, person_id, role || 'member');
    }
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Could not link project team' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await props.params;
  const db = getDb();
  const workspaceId = getDefaultWorkspaceId();
  if (!db.prepare('SELECT id FROM projects WHERE id = ? AND workspace_id = ?').get(projectId, workspaceId)) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  const linkedId = request.nextUrl.searchParams.get('id');
  const type = request.nextUrl.searchParams.get('type');
  if (!linkedId || !['team', 'person'].includes(type || '')) return NextResponse.json({ error: 'Invalid association' }, { status: 400 });
  const result = type === 'team'
    ? db.prepare('DELETE FROM project_teams WHERE project_id = ? AND team_id = ?').run(projectId, linkedId)
    : db.prepare('DELETE FROM project_people WHERE project_id = ? AND person_id = ?').run(projectId, linkedId);
  return NextResponse.json({ removed: !!result.changes });
}