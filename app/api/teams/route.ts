import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getDb, getDefaultWorkspaceId } from '@/lib/db';
import type { Team } from '@/lib/db/schema';

export const dynamic = 'force-dynamic';

function validMembers(db: ReturnType<typeof getDb>, workspaceId: string, memberIds: unknown, teamId?: string): memberIds is string[] {
  if (!Array.isArray(memberIds) || !memberIds.every((id) => typeof id === 'string') || new Set(memberIds).size !== memberIds.length) return false;
  return memberIds.every((id) => !!db.prepare(`SELECT id FROM people WHERE id = ? AND workspace_id = ? AND
    (active = 1 OR EXISTS (SELECT 1 FROM team_memberships WHERE team_id = ? AND person_id = people.id))`).get(id, workspaceId, teamId || ''));
}

export async function GET() {
  const db = getDb();
  const teams = db.prepare('SELECT * FROM teams WHERE workspace_id = ? ORDER BY active DESC, name COLLATE NOCASE').all(getDefaultWorkspaceId()) as (Team & {
    members?: { id: string; name: string; title?: string; active: number; role: string }[];
    projects?: { id: string; name: string }[];
  })[];
  for (const team of teams) {
    team.members = db.prepare(`SELECT p.id, p.name, p.title, p.active, m.role FROM team_memberships m JOIN people p ON p.id = m.person_id WHERE m.team_id = ? ORDER BY p.name COLLATE NOCASE`).all(team.id) as typeof team.members;
    team.projects = db.prepare(`SELECT p.id, p.name FROM project_teams pt JOIN projects p ON p.id = pt.project_id WHERE pt.team_id = ? ORDER BY p.name COLLATE NOCASE`).all(team.id) as typeof team.projects;
  }
  return NextResponse.json({ teams });
}

export async function POST(request: Request) {
  try {
    const { name, description, member_ids = [], lead_person_id } = await request.json();
    const db = getDb();
    const workspaceId = getDefaultWorkspaceId();
    if (typeof name !== 'string' || !name.trim() || name.trim().length > 120 || !validMembers(db, workspaceId, member_ids) ||
      lead_person_id && !member_ids.includes(lead_person_id)) {
      return NextResponse.json({ error: 'A name and valid team members are required' }, { status: 400 });
    }
    const id = uuidv4();
    db.transaction(() => {
      db.prepare('INSERT INTO teams (id, workspace_id, name, description, created_at) VALUES (?, ?, ?, ?, ?)')
        .run(id, workspaceId, name.trim(), typeof description === 'string' ? description.trim() || null : null, new Date().toISOString());
      for (const personId of member_ids) db.prepare('INSERT INTO team_memberships (team_id, person_id, role) VALUES (?, ?, ?)').run(id, personId, personId === lead_person_id ? 'lead' : 'member');
    })();
    return NextResponse.json({ team: db.prepare('SELECT * FROM teams WHERE id = ?').get(id) }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Could not add team' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const { id, name, description, active, member_ids, lead_person_id } = await request.json();
    const db = getDb();
    const workspaceId = getDefaultWorkspaceId();
    if (!db.prepare('SELECT id FROM teams WHERE id = ? AND workspace_id = ?').get(id, workspaceId)) return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    if (name !== undefined && (typeof name !== 'string' || !name.trim() || name.trim().length > 120) ||
        active !== undefined && active !== 0 && active !== 1 ||
        member_ids !== undefined && !validMembers(db, workspaceId, member_ids, id) ||
        lead_person_id && (member_ids === undefined || !member_ids.includes(lead_person_id))) {
      return NextResponse.json({ error: 'Invalid team details' }, { status: 400 });
    }
    db.transaction(() => {
      const updates: string[] = [];
      const values: (string | number | null)[] = [];
      if (name !== undefined) { updates.push('name = ?'); values.push(name.trim()); }
      if (description !== undefined) { updates.push('description = ?'); values.push(description?.trim() || null); }
      if (active !== undefined) { updates.push('active = ?'); values.push(active); }
      if (updates.length) db.prepare(`UPDATE teams SET ${updates.join(', ')} WHERE id = ? AND workspace_id = ?`).run(...values, id, workspaceId);
      if (member_ids !== undefined) {
        db.prepare('DELETE FROM team_memberships WHERE team_id = ?').run(id);
        for (const personId of member_ids) db.prepare('INSERT INTO team_memberships (team_id, person_id, role) VALUES (?, ?, ?)').run(id, personId, personId === lead_person_id ? 'lead' : 'member');
      }
    })();
    return NextResponse.json({ team: db.prepare('SELECT * FROM teams WHERE id = ?').get(id) });
  } catch {
    return NextResponse.json({ error: 'Could not update team' }, { status: 500 });
  }
}