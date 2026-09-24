'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { addDays, format } from 'date-fns';
import { Plus, Pencil, Pause, Play, RefreshCw } from 'lucide-react';
import type { Project, RecurringObligation } from '@/lib/db/schema';

type CadenceForm = {
  title: string;
  description: string;
  project_id: string;
  frequency: RecurringObligation['frequency'];
  next_due_date: string;
  monthly_pattern: 'same_day' | '5th_working_day' | 'last_working_day' | 'weekday';
  weekday_ordinal: string;
  weekday: string;
  source_rule?: string;
  source_due_date?: string;
};

const emptyForm = (): CadenceForm => ({
  title: '', description: '', project_id: '', frequency: 'weekly',
  next_due_date: format(addDays(new Date(), 1), 'yyyy-MM-dd'), monthly_pattern: 'same_day', weekday_ordinal: '1', weekday: '1',
});

const frequencies: { value: RecurringObligation['frequency']; label: string }[] = [
  { value: 'daily', label: 'Daily' }, { value: 'working_days', label: 'Working days' },
  { value: 'weekly', label: 'Weekly' }, { value: 'biweekly', label: 'Every 2 weeks' },
  { value: 'monthly', label: 'Monthly' }, { value: 'quarterly', label: 'Quarterly' }, { value: 'yearly', label: 'Yearly' },
];

export default function CadenceView() {
  const [obligations, setObligations] = useState<RecurringObligation[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [form, setForm] = useState<CadenceForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showPaused, setShowPaused] = useState(false);
  const [error, setError] = useState('');

  const refresh = async () => {
    try {
      const [cadenceResponse, projectResponse] = await Promise.all([fetch('/api/recurring'), fetch('/api/projects')]);
      if (!cadenceResponse.ok || !projectResponse.ok) throw new Error('Could not load cadence');
      setObligations((await cadenceResponse.json()).obligations || []);
      setProjects((await projectResponse.json()).projects || []);
      setError('');
    } catch { setError('Could not load cadence. Please refresh.'); }
  };

  useEffect(() => {
    const requestedProject = new URLSearchParams(window.location.search).get('project_id');
    if (requestedProject) { setForm((current) => ({ ...current, project_id: requestedProject })); setShowForm(true); }
    refresh();
  }, []);

  const closeForm = () => { setShowForm(false); setEditingId(null); setForm(emptyForm()); setError(''); };
  const edit = (item: RecurringObligation) => {
    const weekdayRule = /^weekday:(-1|[1-4]):([0-6])$/.exec(item.recurrence_rule);
    setEditingId(item.id);
    setForm({ title: item.title, description: item.description || '', project_id: item.project_id || '',
      frequency: item.frequency, next_due_date: item.next_due_date,
      source_rule: item.recurrence_rule, source_due_date: item.next_due_date,
      weekday_ordinal: weekdayRule?.[1] || '1', weekday: weekdayRule?.[2] || '1',
      monthly_pattern: item.recurrence_rule === '5th_working_day' || item.recurrence_rule === 'last_working_day'
        ? item.recurrence_rule : weekdayRule ? 'weekday' : 'same_day' });
    setShowForm(true);
    setError('');
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    const rule = form.frequency === 'monthly' && form.monthly_pattern === 'weekday'
      ? `weekday:${form.weekday_ordinal}:${form.weekday}`
      : form.frequency === 'monthly' && form.monthly_pattern !== 'same_day'
        ? form.monthly_pattern
        : form.frequency === 'monthly' || form.frequency === 'quarterly'
        ? form.source_rule?.startsWith('day_of_month:') && form.next_due_date === form.source_due_date
          ? form.source_rule : `day_of_month:${Number(form.next_due_date.slice(8, 10))}`
        : form.frequency === 'yearly'
          ? form.source_rule?.startsWith('month_day:') && form.next_due_date === form.source_due_date
            ? form.source_rule : `month_day:${form.next_due_date.slice(5)}`
        : form.frequency;
    try {
      const response = await fetch(editingId ? `/api/recurring/${editingId}` : '/api/recurring', {
        method: editingId ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: form.title.trim(), description: form.description.trim(), project_id: form.project_id || null,
          frequency: form.frequency, recurrence_rule: rule, next_due_date: form.next_due_date }),
      });
      if (!response.ok) throw new Error((await response.json()).error || 'Could not save cadence');
      closeForm();
      refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save cadence'); }
  };

  const setActive = async (item: RecurringObligation) => {
    try {
      const response = await fetch(`/api/recurring/${item.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: item.active ? 0 : 1 }) });
      if (!response.ok) throw new Error('Could not change cadence status');
      refresh();
    } catch { setError('Could not change cadence status.'); }
  };

  const visible = obligations.filter((item) => showPaused || item.active);

  return <div>
    <div className="page-header page-actions-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
      <div><h1>Cadence</h1><p>Recurring commitments across projects</p></div>
      <button className="btn-capture" onClick={() => { closeForm(); setShowForm(true); }}><Plus size={16} /> New recurring work</button>
    </div>
    {showForm && <form className="inline-form" onSubmit={save} style={{ marginBottom: '1.5rem' }}>
      <h2 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>{editingId ? 'Edit cadence' : 'New recurring work'}</h2>
      <div className="form-row">
        <div className="form-group"><label className="form-label" htmlFor="cadence-title">Title</label><input id="cadence-title" className="form-input" required value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></div>
        <div className="form-group"><label className="form-label" htmlFor="cadence-project">Project</label><select id="cadence-project" className="form-select" value={form.project_id} onChange={(event) => setForm({ ...form, project_id: event.target.value })}><option value="">No project</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></div>
        <div className="form-group"><label className="form-label" htmlFor="cadence-frequency">Repeats</label><select id="cadence-frequency" className="form-select" value={form.frequency} onChange={(event) => setForm({ ...form, frequency: event.target.value as CadenceForm['frequency'] })}>{frequencies.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div>
        <div className="form-group"><label className="form-label" htmlFor="cadence-next">Next due</label><input id="cadence-next" className="form-input" type="date" required value={form.next_due_date} onChange={(event) => setForm({ ...form, next_due_date: event.target.value })} /></div>
        {form.frequency === 'monthly' && <div className="form-group"><label className="form-label" htmlFor="cadence-monthly">Monthly timing</label><select id="cadence-monthly" className="form-select" value={form.monthly_pattern} onChange={(event) => setForm({ ...form, monthly_pattern: event.target.value as CadenceForm['monthly_pattern'] })}><option value="same_day">Same calendar day</option><option value="5th_working_day">5th working day</option><option value="last_working_day">Last working day</option><option value="weekday">Weekday of month</option></select></div>}
        {form.frequency === 'monthly' && form.monthly_pattern === 'weekday' && <>
          <div className="form-group"><label className="form-label" htmlFor="cadence-ordinal">Week</label><select id="cadence-ordinal" className="form-select" value={form.weekday_ordinal} onChange={(event) => setForm({ ...form, weekday_ordinal: event.target.value })}><option value="1">First</option><option value="2">Second</option><option value="3">Third</option><option value="4">Fourth</option><option value="-1">Last</option></select></div>
          <div className="form-group"><label className="form-label" htmlFor="cadence-weekday">Day</label><select id="cadence-weekday" className="form-select" value={form.weekday} onChange={(event) => setForm({ ...form, weekday: event.target.value })}>{['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((day, index) => <option value={index} key={day}>{day}</option>)}</select></div>
        </>}
      </div>
      <div className="form-group" style={{ marginTop: '0.75rem' }}><label className="form-label" htmlFor="cadence-description">Context</label><textarea id="cadence-description" className="form-input" rows={2} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></div>
      {error && <p role="alert" className="work-error">{error}</p>}
      <div className="form-actions"><button type="button" className="btn-secondary" onClick={closeForm}>Cancel</button><button type="submit" className="btn-capture">Save cadence</button></div>
    </form>}
    {!showForm && error && <p role="alert" className="work-error">{error}</p>}
    <div className="work-section-heading" style={{ marginBottom: '0.65rem' }}><h2>Recurring rules ({visible.length})</h2><label style={{ fontSize: '0.82rem' }}><input type="checkbox" checked={showPaused} onChange={(event) => setShowPaused(event.target.checked)} /> Show paused</label></div>
    {visible.length === 0 && <p className="work-muted">No recurring work in this view.</p>}
    {visible.map((item) => <div className="work-row" key={item.id}>
      <RefreshCw size={17} aria-hidden="true" />
      <div className="work-row-content"><strong>{item.title}</strong><small>{item.project_name ? <Link href={`/projects/${item.project_id}`}>{item.project_name}</Link> : 'Personal'} · {item.frequency.replace('_', ' ')} · Next {item.next_due_date}{item.active ? '' : ' · Paused'}</small></div>
      <button type="button" className="btn-secondary" onClick={() => edit(item)} title="Edit recurrence" aria-label={`Edit ${item.title}`}><Pencil size={15} /></button>
      <button type="button" className="btn-secondary" onClick={() => setActive(item)} title={item.active ? 'Pause recurrence' : 'Resume recurrence'} aria-label={`${item.active ? 'Pause' : 'Resume'} ${item.title}`}>{item.active ? <Pause size={15} /> : <Play size={15} />}</button>
    </div>)}
  </div>;
}