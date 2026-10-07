import { fromZonedTime } from 'date-fns-tz';

export type PlanningTask = { id: string; title: string; status: string; due_date: string | null; estimated_minutes: number; priority: string; archived?: number; project_name?: string; project_id?: string; planned_delivery_date?: string };
export type PlanningDependency = { task_id: string; depends_on_task_id: string };

export function calculateCapacity(date: string, timezone: string, startTime: string, endTime: string, dailyMinutes: number, weekendDays: number[], events: { start_time: string; end_time: string; is_all_day?: number }[], remainingFrom?: number) {
  const windowStart = fromZonedTime(`${date}T${startTime}:00`, timezone).getTime();
  const end = fromZonedTime(`${date}T${endTime}:00`, timezone).getTime();
  const start = Math.min(end, Math.max(windowStart, remainingFrom || windowStart));
  const off = weekendDays.includes(new Date(`${date}T12:00:00Z`).getUTCDay());
  const meetings = events.filter((event) => !event.is_all_day).map((event) => ({ start: Math.max(start, Date.parse(event.start_time)), end: Math.min(end, Date.parse(event.end_time)) })).filter((event) => event.end > event.start).sort((first, second) => first.start - second.start);
  const merged: { start: number; end: number }[] = [];
  for (const event of meetings) {
    const last = merged[merged.length - 1];
    if (last && event.start <= last.end) last.end = Math.max(last.end, event.end);
    else merged.push({ ...event });
  }
  const blocks: { start: string; end: string; minutes: number }[] = [];
  let cursor = start;
  for (const event of merged) { if (event.start > cursor) blocks.push({ start: new Date(cursor).toISOString(), end: new Date(event.start).toISOString(), minutes: (event.start - cursor) / 60000 }); cursor = event.end; }
  if (cursor < end) blocks.push({ start: new Date(cursor).toISOString(), end: new Date(end).toISOString(), minutes: (end - cursor) / 60000 });
  const meetingMinutes = merged.reduce((sum, event) => sum + (event.end - event.start) / 60000, 0);
  return { start: new Date(start).toISOString(), end: new Date(end).toISOString(), off, meeting_minutes: Math.round(meetingMinutes), available_minutes: off ? 0 : Math.max(0, Math.min(dailyMinutes, (end - start) / 60000 - meetingMinutes)), free_blocks: off ? [] : blocks };
}

export function unblockRadar(tasks: PlanningTask[], dependencies: PlanningDependency[], complete?: string) {
  const byId = new Map(tasks.map((task) => [task.id, task]));
  const prerequisites = new Map<string, string[]>(); const dependents = new Map<string, string[]>();
  for (const dependency of dependencies) {
    prerequisites.set(dependency.task_id, [...(prerequisites.get(dependency.task_id) || []), dependency.depends_on_task_id]);
    dependents.set(dependency.depends_on_task_id, [...(dependents.get(dependency.depends_on_task_id) || []), dependency.task_id]);
  }
  const active = (id: string, simulated = false) => !!byId.get(id) && !['done', 'cancelled'].includes(byId.get(id)!.status) && !(simulated && id === complete);
  const blockers = (id: string, simulated = false) => (prerequisites.get(id) || []).filter((parent) => active(parent, simulated));
  const radar = tasks.filter((task) => active(task.id) && !task.archived).map((task) => {
    const queue = [...(dependents.get(task.id) || [])]; const downstream = new Set<string>();
    while (queue.length) { const id = queue.shift()!; if (id === task.id || downstream.has(id) || !active(id)) continue; downstream.add(id); queue.push(...(dependents.get(id) || [])); }
    const releases = [...downstream].map((id) => byId.get(id)!).filter(Boolean);
    return { ...task, blockers: blockers(task.id), impact_count: downstream.size, projects_released: new Set(releases.map((entry) => entry.project_id).filter(Boolean)).size,
      downstream: releases.map((entry) => ({ id: entry.id, title: entry.title, due_date: entry.due_date, project_name: entry.project_name })),
      ready: blockers(task.id).length === 0 && !['waiting', 'blocked'].includes(task.status) };
  }).sort((first, second) => second.impact_count - first.impact_count || (first.due_date || '9999').localeCompare(second.due_date || '9999'));
  const newlyReady = complete ? tasks.filter((task) => !task.archived && task.id !== complete && active(task.id) && blockers(task.id).length > 0 && blockers(task.id, true).length === 0) : [];
  return { radar, newly_ready: newlyReady };
}