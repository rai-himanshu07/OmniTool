import { NextRequest, NextResponse } from 'next/server';
import { getDb, getDefaultWorkspaceId } from '@/lib/db';
import { format, isToday, isThisWeek, parseISO, isBefore, startOfToday, startOfWeek, endOfWeek } from 'date-fns';
import { runAttentionSweep } from '@/lib/services/notificationEngine';
import { getAccess } from '@/lib/services/workspaceAccess';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const access = await getAccess(request);
    const searchParams = request.nextUrl.searchParams;
    const period = searchParams.get('period') || 'today';
    const projectId = searchParams.get('project_id');
    const priority = searchParams.get('priority'); // comma separated
    const scope = searchParams.get('scope') || 'mine';
    const clientId = searchParams.get('client_id');
    const personId = searchParams.get('person_id');
    const scopeFilter = (alias: string, type: string) => scope === 'following'
      ? ` AND EXISTS (SELECT 1 FROM work_following w WHERE w.workspace_id = ${alias}.workspace_id AND w.user_id = @user AND w.entity_type = '${type}' AND w.entity_id = ${alias}.id)`
      : scope === 'workspace' ? '' : type === 'task'
      ? ` AND ((${alias}.assignee_person_id IS NOT NULL AND ${alias}.assignee_person_id = @person) OR (${alias}.assignee_person_id IS NULL AND lower(${alias}.owner) = lower(@name)))`
      : ` AND lower(${alias}.owner) = lower(@name)`;
    const ownership = { user: access.user.id, person: access.person_id, name: access.user.name };
    
    const workspaceId = getDefaultWorkspaceId();
    const db = getDb();

    try {
      runAttentionSweep();
    } catch (err) {
      console.error('runAttentionSweep failed:', err);
    }
    
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const today = startOfToday();
    const thisWeekStart = format(startOfWeek(today), 'yyyy-MM-dd');
    const thisWeekEnd = format(endOfWeek(today), 'yyyy-MM-dd');

    // 1. Fetch Tasks
    let tasksQuery = `
      SELECT t.*, p.name as project_name
      FROM tasks t
      LEFT JOIN projects p ON t.project_id = p.id
      WHERE t.workspace_id = ? AND t.archived = 0 AND t.status NOT IN ('done', 'cancelled') ${scopeFilter('t', 'task')}
    `;
    const tasksParams: any[] = [workspaceId];
    if (clientId) { tasksQuery += ' AND p.client_id = ?'; tasksParams.push(clientId); }
    if (personId) { tasksQuery += ' AND t.assignee_person_id = ?'; tasksParams.push(personId); }
    if (period === 'waiting') tasksQuery += " AND t.status IN ('waiting', 'blocked')";

    if (projectId) {
      tasksQuery += ` AND t.project_id = ?`;
      tasksParams.push(projectId);
    }
    
    if (priority) {
      const priorities = priority.split(',').map(p => p.trim());
      tasksQuery += ` AND t.priority IN (${priorities.map(() => '?').join(',')})`;
      tasksParams.push(...priorities);
    }

    const summaryQuery = tasksQuery;
    const summaryParams = [...tasksParams];
    if (period === 'today') {
      tasksQuery += ` AND (t.due_date <= ? OR t.due_date IS NULL)`;
      tasksParams.push(todayStr);
    } else if (period === 'this_week') {
      tasksQuery += ` AND t.due_date >= ? AND t.due_date <= ?`;
      tasksParams.push(thisWeekStart, thisWeekEnd);
    } else if (period === 'overdue') {
      tasksQuery += ` AND t.due_date < ?`;
      tasksParams.push(todayStr);
    }

    const tasks = db.prepare(tasksQuery).all(...(scope === 'workspace' ? tasksParams : [ownership, ...tasksParams]));
    
    // Also count all overdue tasks for summary regardless of period
    const overdueCountRow = db.prepare(`SELECT COUNT(*) AS c FROM (${summaryQuery}) filtered WHERE due_date < ?`)
      .get(...(scope === 'workspace' ? [...summaryParams, todayStr] : [ownership, ...summaryParams, todayStr])) as { c: number };
    const overdueCount = overdueCountRow.c;

    // 2. Fetch Active followups
    let followupsQuery = `
      SELECT f.*, p.name as project_name, 
             CAST(julianday(?) - julianday(f.last_activity_at) AS INTEGER) as waiting_days
      FROM followups f
      LEFT JOIN projects p ON f.project_id = p.id
      WHERE f.workspace_id = ? AND f.archived = 0 AND f.status IN ('waiting', 'escalated') ${scopeFilter('f', 'followup')}
    `;
    const followupsParams: any[] = [new Date().toISOString(), workspaceId];
    if (period === 'today') { followupsQuery += ' AND (f.expected_date <= ? OR f.expected_date IS NULL)'; followupsParams.push(todayStr); }
    else if (period === 'this_week') { followupsQuery += ' AND f.expected_date >= ? AND f.expected_date <= ?'; followupsParams.push(thisWeekStart, thisWeekEnd); }
    else if (period === 'overdue') { followupsQuery += ' AND f.expected_date < ?'; followupsParams.push(todayStr); }
    if (clientId) { followupsQuery += ' AND p.client_id = ?'; followupsParams.push(clientId); }
    if (personId) { followupsQuery += ' AND f.waiting_on_person_id = ?'; followupsParams.push(personId); }
    
    if (projectId) {
      followupsQuery += ` AND f.project_id = ?`;
      followupsParams.push(projectId);
    }
    
    if (priority) {
      const priorities = priority.split(',').map(p => p.trim());
      followupsQuery += ` AND f.priority IN (${priorities.map(() => '?').join(',')})`;
      followupsParams.push(...priorities);
    }
    
    const followups = db.prepare(followupsQuery).all(...(scope === 'workspace' ? followupsParams : [ownership, ...followupsParams]));

    // 3. Today's calendar events
    const eventStart = period === 'this_week' ? startOfWeek(today) : today;
    const eventEnd = period === 'this_week' || period === 'all' ? endOfWeek(today) : new Date(today.getTime() + 86400000);
    const todayStartIso = eventStart.toISOString();
    const todayEndIso = eventEnd.toISOString();
    const eventsQuery = `
      SELECT * FROM calendar_events 
      WHERE workspace_id = ? AND archived = 0 AND end_time >= ? AND start_time < ?
      ORDER BY start_time ASC
    `;
    const events = db.prepare(eventsQuery).all(workspaceId, todayStartIso, todayEndIso);

    // 4. Upcoming cadence rules; due occurrences have already become tasks.
    const recurringQuery = `
      SELECT r.*, p.name as project_name FROM recurring_obligations r
      LEFT JOIN projects p ON p.id = r.project_id
      WHERE r.workspace_id = ? AND r.active = 1 AND r.next_due_date <= ?
      ORDER BY r.next_due_date ASC
    `;
    const upcomingThrough = format(endOfWeek(today), 'yyyy-MM-dd');
    const recurring = db.prepare(recurringQuery).all(workspaceId, upcomingThrough);

    // 5. Pending inbox count
    const inboxCountRow = db.prepare(`
      SELECT COUNT(*) as c FROM inbox_items 
      WHERE workspace_id = ? AND status = 'raw'
    `).get(workspaceId) as { c: number };
    const inboxCount = inboxCountRow.c;

    return NextResponse.json({
      tasks,
      followups,
      events,
      recurring,
      inbox_count: inboxCount,
      summary: {
        tasks_count: tasks.length,
        followups_count: followups.length,
        events_count: events.length,
        recurring_count: recurring.length,
        overdue_count: overdueCount
      }
    });

  } catch (error: any) {
    console.error('My Work API error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
