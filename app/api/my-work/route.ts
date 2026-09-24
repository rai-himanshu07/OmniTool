import { NextRequest, NextResponse } from 'next/server';
import { getDb, getDefaultWorkspaceId } from '@/lib/db';
import { format, isToday, isThisWeek, parseISO, isBefore, startOfToday, startOfWeek, endOfWeek } from 'date-fns';
import { runAttentionSweep } from '@/lib/services/notificationEngine';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const period = searchParams.get('period') || 'today';
    const projectId = searchParams.get('project_id');
    const priority = searchParams.get('priority'); // comma separated
    
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
      WHERE t.workspace_id = ? AND t.status NOT IN ('done', 'cancelled')
    `;
    const tasksParams: any[] = [workspaceId];

    if (projectId) {
      tasksQuery += ` AND t.project_id = ?`;
      tasksParams.push(projectId);
    }
    
    if (priority) {
      const priorities = priority.split(',').map(p => p.trim());
      tasksQuery += ` AND t.priority IN (${priorities.map(() => '?').join(',')})`;
      tasksParams.push(...priorities);
    }

    if (period === 'today') {
      tasksQuery += ` AND (t.due_date = ? OR t.due_date IS NULL)`;
      tasksParams.push(todayStr);
    } else if (period === 'this_week') {
      tasksQuery += ` AND t.due_date >= ? AND t.due_date <= ?`;
      tasksParams.push(thisWeekStart, thisWeekEnd);
    } else if (period === 'overdue') {
      tasksQuery += ` AND t.due_date < ?`;
      tasksParams.push(todayStr);
    }

    const tasks = db.prepare(tasksQuery).all(...tasksParams);
    
    // Also count all overdue tasks for summary regardless of period
    const overdueCountRow = db.prepare(`
      SELECT COUNT(*) as c FROM tasks 
      WHERE workspace_id = ? AND status NOT IN ('done', 'cancelled') AND due_date < ?
    `).get(workspaceId, todayStr) as { c: number };
    const overdueCount = overdueCountRow.c;

    // 2. Fetch Active followups
    let followupsQuery = `
      SELECT f.*, p.name as project_name, 
             CAST(julianday(?) - julianday(f.created_at) AS INTEGER) as waiting_days
      FROM followups f
      LEFT JOIN projects p ON f.project_id = p.id
      WHERE f.workspace_id = ? AND f.status = 'waiting'
    `;
    const followupsParams: any[] = [todayStr, workspaceId];
    
    if (projectId) {
      followupsQuery += ` AND f.project_id = ?`;
      followupsParams.push(projectId);
    }
    
    if (priority) {
      const priorities = priority.split(',').map(p => p.trim());
      followupsQuery += ` AND f.priority IN (${priorities.map(() => '?').join(',')})`;
      followupsParams.push(...priorities);
    }
    
    const followups = db.prepare(followupsQuery).all(...followupsParams);

    // 3. Today's calendar events
    const todayStartIso = format(today, "yyyy-MM-dd'T'00:00:00");
    const todayEndIso = format(today, "yyyy-MM-dd'T'23:59:59");
    const eventsQuery = `
      SELECT * FROM calendar_events 
      WHERE workspace_id = ? AND start_time >= ? AND start_time <= ?
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
