import { getDb, getDefaultWorkspaceId } from '../db';
import { Task, Followup, Project } from '../db/schema';

export interface AttentionItem {
  id: string;
  type: 'task_overdue' | 'followup_stalled' | 'project_risk' | 'due_today' | 'followup_due_today';
  title: string;
  subtitle: string;
  severity: 'critical' | 'high' | 'medium';
  related_entity_type: 'task' | 'followup' | 'project';
  related_entity_id: string;
  days_elapsed?: number;
  project_name?: string;
}

export interface DashboardMetrics {
  overdue_tasks_count: number;
  due_today_tasks_count: number;
  active_followups_count: number;
  waiting_followups_count: number;
  today_meetings_count: number;
  cadence_due_count: number;
  raw_inbox_count: number;
  projects_summary: {
    total: number;
    green: number;
    amber: number;
    red: number;
  };
}

export function getAttentionItems(): AttentionItem[] {
  const db = getDb();
  const wsId = getDefaultWorkspaceId();
  const todayStr = new Date().toISOString().split('T')[0];
  const items: AttentionItem[] = [];

  // 1. Critical/Overdue tasks
  const overdueTasks = db
    .prepare(
      `SELECT t.*, p.name as project_name 
       FROM tasks t 
       LEFT JOIN projects p ON t.project_id = p.id 
       WHERE t.workspace_id = ? AND t.status NOT IN ('done', 'cancelled') AND t.due_date < ? 
       ORDER BY t.due_date ASC`
    )
    .all(wsId, todayStr) as (Task & { project_name?: string })[];

  for (const task of overdueTasks) {
    const isCritical = task.priority === 'critical' || task.priority === 'high';
    const dueDate = task.due_date ? new Date(task.due_date) : new Date();
    const daysOverdue = Math.max(1, Math.floor((Date.now() - dueDate.getTime()) / (1000 * 60 * 60 * 24)));

    items.push({
      id: `att-task-${task.id}`,
      type: 'task_overdue',
      title: task.title,
      subtitle: task.project_name
        ? `Project: ${task.project_name} • Overdue by ${daysOverdue} day${daysOverdue > 1 ? 's' : ''}`
        : `Overdue by ${daysOverdue} day${daysOverdue > 1 ? 's' : ''}`,
      severity: isCritical ? 'critical' : 'high',
      related_entity_type: 'task',
      related_entity_id: task.id,
      days_elapsed: daysOverdue,
      project_name: task.project_name,
    });
  }

  // 2. Stalled follow-ups (Waiting > 2 days)
  const followups = db
    .prepare(
      `SELECT f.*, p.name as project_name, t.title as task_title 
       FROM followups f 
       LEFT JOIN projects p ON f.project_id = p.id 
       LEFT JOIN tasks t ON f.task_id = t.id 
       WHERE f.workspace_id = ? AND f.status = 'waiting' 
       ORDER BY f.created_at ASC`
    )
    .all(wsId) as (Followup & { project_name?: string; task_title?: string })[];

  for (const f of followups) {
    const createdDate = new Date(f.created_at);
    const waitingDays = Math.floor((Date.now() - createdDate.getTime()) / (1000 * 60 * 60 * 24));

    if (waitingDays >= 2 || f.priority === 'critical' || f.priority === 'high') {
      items.push({
        id: `att-fup-${f.id}`,
        type: 'followup_stalled',
        title: `${f.waiting_on_person} — ${f.title}`,
        subtitle: `Waiting ${waitingDays} day${waitingDays !== 1 ? 's' : ''}${f.expected_date ? ` • Expected: ${f.expected_date}` : ''}`,
        severity: waitingDays >= 3 || f.priority === 'critical' ? 'critical' : 'high',
        related_entity_type: 'followup',
        related_entity_id: f.id,
        days_elapsed: waitingDays,
        project_name: f.project_name,
      });
    }
  }

  // 3. Project Risks (Planned delivery within 3 days with open critical/high tasks or override red)
  const projects = db
    .prepare(
      `SELECT p.*, c.name as client_name 
       FROM projects p 
       LEFT JOIN clients c ON p.client_id = c.id 
       WHERE p.workspace_id = ? AND p.status NOT IN ('completed')`
    )
    .all(wsId) as (Project & { client_name?: string })[];

  for (const proj of projects) {
    if (overdueTasks.some((task) => task.project_id === proj.id)) continue;
    const status = getCalculatedProjectHealth(proj.id);
    if (status === 'red' || status === 'amber') {
      items.push({
        id: `att-proj-${proj.id}`,
        type: 'project_risk',
        title: `${proj.client_name ? `${proj.client_name} — ` : ''}${proj.name}`,
        subtitle: `Project delivery planned for ${proj.planned_delivery_date || 'N/A'} • Attention state: ${status.toUpperCase()}`,
        severity: status === 'red' ? 'critical' : 'high',
        related_entity_type: 'project',
        related_entity_id: proj.id,
        project_name: proj.name,
      });
    }
  }

  return items;
}

export function getCalculatedProjectHealth(projectId: string): 'green' | 'amber' | 'red' {
  const db = getDb();
  const todayStr = new Date().toISOString().split('T')[0];

  const proj = db.prepare(`SELECT status, status_override, planned_delivery_date FROM projects WHERE id = ?`).get(projectId) as
    | { status: string; status_override?: string; planned_delivery_date?: string }
    | undefined;

  if (!proj) return 'green';
  if (proj.status_override && ['green', 'amber', 'red'].includes(proj.status_override)) {
    return proj.status_override as 'green' | 'amber' | 'red';
  }

  const overdueCount = (
    db.prepare(`SELECT COUNT(*) as c FROM tasks WHERE project_id = ? AND status NOT IN ('done', 'cancelled') AND due_date < ?`).get(projectId, todayStr) as { c: number }
  ).c;

  const criticalOverdue = (
    db
      .prepare(
        `SELECT COUNT(*) as c FROM tasks WHERE project_id = ? AND status NOT IN ('done', 'cancelled') AND due_date < ? AND priority IN ('critical', 'high')`
      )
      .get(projectId, todayStr) as { c: number }
  ).c;

  const stalledFollowups = (
    db
      .prepare(
        `SELECT COUNT(*) as c FROM followups WHERE project_id = ? AND status = 'waiting' AND julianday('now') - julianday(last_activity_at) > 3`
      )
      .get(projectId) as { c: number }
  ).c;

  if (criticalOverdue > 0 || stalledFollowups > 1) return 'red';
  if (overdueCount > 0 || stalledFollowups > 0) return 'amber';
  return 'green';
}

export function getDashboardMetrics(): DashboardMetrics {
  const db = getDb();
  const wsId = getDefaultWorkspaceId();
  const todayStr = new Date().toISOString().split('T')[0];

  const overdue = (
    db.prepare(`SELECT COUNT(*) as c FROM tasks WHERE workspace_id = ? AND status NOT IN ('done', 'cancelled') AND due_date < ?`).get(wsId, todayStr) as { c: number }
  ).c;

  const dueToday = (
    db.prepare(`SELECT COUNT(*) as c FROM tasks WHERE workspace_id = ? AND status NOT IN ('done', 'cancelled') AND due_date = ?`).get(wsId, todayStr) as { c: number }
  ).c;

  const activeFollowups = (
    db.prepare(`SELECT COUNT(*) as c FROM followups WHERE workspace_id = ? AND status IN ('waiting', 'escalated')`).get(wsId) as { c: number }
  ).c;

  const rawInbox = (
    db.prepare(`SELECT COUNT(*) as c FROM inbox_items WHERE workspace_id = ? AND status = 'raw'`).get(wsId) as { c: number }
  ).c;

  const cadenceDue = (
    db.prepare(`SELECT COUNT(*) as c FROM recurring_obligations WHERE workspace_id = ? AND active = 1 AND next_due_date <= ?`).get(wsId, todayStr) as { c: number }
  ).c;

  const meetingsToday = (
    db.prepare(`SELECT COUNT(*) as c FROM calendar_events WHERE workspace_id = ? AND substr(start_time, 1, 10) = ?`).get(wsId, todayStr) as { c: number }
  ).c;

  const projects = db.prepare(`SELECT id, status FROM projects WHERE workspace_id = ? AND status NOT IN ('completed')`).all(wsId) as { id: string; status: string }[];

  let g = 0,
    a = 0,
    r = 0;
  for (const p of projects) {
    const health = getCalculatedProjectHealth(p.id);
    if (health === 'red') r++;
    else if (health === 'amber') a++;
    else g++;
  }

  return {
    overdue_tasks_count: overdue,
    due_today_tasks_count: dueToday,
    active_followups_count: activeFollowups,
    waiting_followups_count: activeFollowups,
    today_meetings_count: meetingsToday,
    cadence_due_count: cadenceDue,
    raw_inbox_count: rawInbox,
    projects_summary: {
      total: projects.length,
      green: g,
      amber: a,
      red: r,
    },
  };
}
