'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CalendarDays, Target, GitBranch, Radar, ArrowRight } from 'lucide-react';
import { requestJson } from '@/lib/client';
export default function PlanningView() {
  const [data, setData] = useState<any>(null);
  const [date, setDate] = useState('');
  const [complete, setComplete] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let current = true;
    setLoading(true);
    requestJson(`/api/planning?${new URLSearchParams({ ...(date ? { date } : {}), ...(complete ? { complete } : {}) })}`)
      .then((result) => { if (current) { setData(result); setStatus(''); setLoading(false); } })
      .catch((error) => { if (current) { setStatus(String(error)); setLoading(false); } });
    return () => { current = false; };
  }, [date, complete]);
  const time = (value: string) => new Intl.DateTimeFormat('en', { timeZone: data.timezone, hour: '2-digit', minute: '2-digit' }).format(new Date(value));
  return <div className="planning-view" aria-busy={loading}><div className="page-header"><h1>Day Planner</h1></div>
    <div className="file-toolbar"><CalendarDays size={18} /><input className="form-input" aria-label="Planning date" type="date" value={date || data?.date || ''} onChange={(event) => setDate(event.target.value)} /><Link href="/preferences">Working-time preferences</Link>{data && <span className="badge">{data.timezone}</span>}</div>{status && <p role="status">{status}</p>}
    {loading && <p role="status">Loading plan...</p>}
    {data && <><section className="planning-capacity"><div><span>Available</span><strong>{Math.round(data.capacity.available_minutes / 60 * 10) / 10} h</strong></div><div><span>Meetings</span><strong>{Math.round(data.capacity.meeting_minutes / 60 * 10) / 10} h</strong></div><div><span>Due work</span><strong>{Math.round(data.workload_minutes / 60 * 10) / 10} h</strong></div><div><span>{data.capacity.off ? 'Day off' : data.overload_minutes ? 'Over capacity' : 'Headroom'}</span><strong>{Math.round(Math.abs(data.overload_minutes || data.capacity.available_minutes - data.workload_minutes))} min</strong></div></section>
      <div className="capacity-meter" role="meter" aria-label="Due work against available time" aria-valuemin={0} aria-valuemax={Math.max(data.capacity.available_minutes, data.workload_minutes, 1)} aria-valuenow={data.workload_minutes}><span style={{ width: `${Math.min(100, data.workload_minutes / Math.max(1, data.capacity.available_minutes) * 100)}%`, background: data.overload_minutes ? 'var(--danger)' : 'var(--success)' }} /></div>
      <section className="planning-section"><h2><Target size={18} /> Work That Fits</h2><div className="planning-timeline">{data.suggestions.map((task: any) => <div className="planning-row" key={task.id}><time>{time(task.start)} - {time(task.end)}</time><div><Link href={`/tasks/${task.id}`}>{task.title}</Link><small>{task.project_name || 'No project'} · {task.estimated_minutes} min</small></div><button className="btn-secondary" disabled={loading} onClick={async () => { try { await requestJson('/api/focus', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ date: data.date, entity_type: 'task', entity_id: task.id }) }); setStatus('Added to Focus Plan'); } catch (error) { setStatus(String(error)); } }}><Target size={15} /> Focus</button></div>)}</div>{!data.suggestions.length && <p className="work-muted">No ready work fits this working day.</p>}
        {data.mine.filter((task: any) => !task.ready).map((task: any) => <p key={task.id} className="work-error"><Link href={`/tasks/${task.id}`}>{task.title}</Link> is blocked or waiting.</p>)}
      </section>
      <section className="planning-section"><h2><Radar size={18} /> Unblock Radar</h2><div className="file-toolbar"><label>Preview completion<select className="form-select" value={complete} onChange={(event) => setComplete(event.target.value)}><option value="">Current state</option>{data.radar.map((task: any) => <option key={task.id} value={task.id}>{task.title}</option>)}</select></label>{complete && <span className="badge">Preview only</span>}</div>
        {complete && <div className="simulation-result"><strong>{data.newly_ready.length} tasks would have no remaining dependency blockers</strong>{data.newly_ready.map((task: any) => <Link href={`/tasks/${task.id}`} key={task.id}><ArrowRight size={14} /> {task.title}</Link>)}</div>}
        {data.radar.map((task: any) => <div className="radar-row" key={task.id}><div className="radar-impact"><strong>{task.impact_count}</strong><span>downstream</span></div><div className="radar-context"><Link href={`/tasks/${task.id}`}>{task.title}</Link><small>{task.project_name || 'Cross-project work'} · {task.projects_released} projects · {task.ready ? 'Ready' : `${task.blockers.length} dependency blockers`}</small><details><summary><GitBranch size={14} /> Impact chain</summary>{task.downstream.map((related: any) => <div className="radar-dependent" key={related.id}><Link href={`/tasks/${related.id}`}>{related.title}</Link><span>{related.project_name} {related.due_date || ''}</span></div>)}</details></div><button className="btn-secondary" onClick={() => setComplete(task.id)}>Preview</button></div>)}
        {!data.radar.length && <p className="work-muted">No active dependency chains.</p>}
      </section>
    </>}
  </div>;
}