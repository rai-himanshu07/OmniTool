'use client';
import { useEffect, useState } from 'react';
import { BookmarkPlus, Check, CalendarDays, Archive, Trash2, UserRound, Eye, X } from 'lucide-react';
import { requestJson } from '@/lib/client';

export type WorkFilters = { scope: string; project_id: string; client_id: string; person_id: string; priority: string };
export default function WorkControls({ filters, period, onChange, onPeriod, selected, onUpdated }: {
  filters: WorkFilters; period: string; onChange: (filters: WorkFilters) => void; onPeriod: (period: string) => void;
  selected: { type: string; id: string }[]; onUpdated: () => void;
}) {
  const [projects, setProjects] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [people, setPeople] = useState<any[]>([]);
  const [views, setViews] = useState<any[]>([]);
  const [status, setStatus] = useState('');
  const [date, setDate] = useState('');
  const [person, setPerson] = useState('');
  const [name, setName] = useState('');
  const loadViews = async () => { try { setViews((await requestJson('/api/work-views')).views); } catch (error) { setStatus(String(error)); } };
  useEffect(() => { loadViews(); requestJson('/api/projects').then((data) => setProjects(data.projects || [])); requestJson('/api/clients').then((data) => setClients(data.clients || [])); requestJson('/api/people').then((data) => setPeople(data.people || [])); }, []);
  const change = (key: keyof WorkFilters, value: string) => onChange({ ...filters, [key]: value });
  const action = async (action: string) => {
    if (['trash', 'cancel'].includes(action) && !confirm(`${action === 'trash' ? 'Move to Trash' : 'Cancel'} ${selected.length} selected items?`)) return;
    try {
      const result = await requestJson('/api/work/actions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items: selected, action, date, person_id: person }) });
      for (const item of result.results || []) if (item.trash_id) window.dispatchEvent(new CustomEvent('omnitool:trashed', { detail: item.trash_id }));
      setStatus(`${selected.length} items updated`); onUpdated();
    } catch (error) { setStatus(String(error)); }
  };
  return <section className="work-controls">
    <div className="form-row">
      <label>Scope<select className="form-select" value={filters.scope} onChange={(event) => change('scope', event.target.value)}><option value="mine">Assigned to me</option><option value="following">Following</option><option value="workspace">Workspace</option></select></label>
      <label>Project<select className="form-select" value={filters.project_id} onChange={(event) => change('project_id', event.target.value)}><option value="">All projects</option>{projects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label>Client<select className="form-select" value={filters.client_id} onChange={(event) => change('client_id', event.target.value)}><option value="">All clients</option>{clients.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label>Person<select className="form-select" value={filters.person_id} onChange={(event) => change('person_id', event.target.value)}><option value="">All people</option>{people.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label>Priority<select className="form-select" value={filters.priority} onChange={(event) => change('priority', event.target.value)}><option value="">All priorities</option>{['critical', 'high', 'medium', 'low'].map((value) => <option key={value}>{value}</option>)}</select></label>
    </div>
    <div className="form-row"><select className="form-select" aria-label="Saved views" defaultValue="" onChange={(event) => { const view = views.find((item) => item.id === event.target.value); if (view) { onChange({ ...filters, ...view.filters }); if (view.filters.period) onPeriod(view.filters.period); } }}><option value="">Saved views</option>{views.map((view) => <option key={view.id} value={view.id}>{view.name}</option>)}</select><input className="form-input" aria-label="View name" placeholder="View name" value={name} onChange={(event) => setName(event.target.value)} /><button className="btn-secondary" disabled={!name.trim()} onClick={async () => { try { await requestJson('/api/work-views', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, filters: { ...filters, period } }) }); setName(''); loadViews(); } catch (error) { setStatus(String(error)); } }}><BookmarkPlus size={16} /> Save view</button></div>
    {selected.length > 0 && <div className="bulk-toolbar"><strong>{selected.length} selected</strong><input className="form-input" type="date" aria-label="Reschedule selected items" value={date} onChange={(event) => setDate(event.target.value)} /><button className="btn-secondary" disabled={!date} onClick={() => action('reschedule')}><CalendarDays size={16} /> Reschedule</button><select className="form-select" aria-label="Reassign selected tasks" value={person} onChange={(event) => setPerson(event.target.value)}><option value="">Assign to...</option>{people.filter((item) => item.active).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><button className="btn-secondary" disabled={!person || selected.some((item) => item.type !== 'task')} onClick={() => action('assign')}><UserRound size={16} /> Assign</button><button className="btn-secondary" onClick={() => action('complete')}><Check size={16} /> Complete</button><button className="btn-secondary" onClick={() => action('follow')}><Eye size={16} /> Follow</button><button className="btn-secondary" onClick={() => action('unfollow')}><Eye size={16} /> Unfollow</button><button className="btn-secondary" onClick={() => action('archive')}><Archive size={16} /> Archive</button><button className="btn-secondary" onClick={() => action('cancel')}><X size={16} /> Cancel</button><button className="btn-secondary" onClick={() => action('trash')}><Trash2 size={16} /> Trash</button></div>}
    {status && <p role="status">{status}</p>}
    {views.length > 0 && <details><summary>Manage saved views</summary>{views.map((view) => <div className="recovery-row" key={view.id}><span>{view.name}</span><button className="notification-trigger" title={`Delete ${view.name}`} onClick={async () => { try { await requestJson(`/api/work-views?id=${view.id}`, { method: 'DELETE' }); loadViews(); } catch (error) { setStatus(String(error)); } }}><Trash2 size={16} /></button></div>)}</details>}
  </section>;
}