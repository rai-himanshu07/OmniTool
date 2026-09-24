'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { addDays, format, parseISO } from 'date-fns';
import { ArrowDown, ArrowUp, Check, CornerDownRight, Plus, Save, Target, X } from 'lucide-react';

type FocusItem = {
  id: string;
  focus_date: string;
  entity_type: 'task' | 'followup';
  entity_id: string;
  title: string;
  project_name: string;
  entity_status: string;
  next_action: string;
  state: 'active' | 'completed' | 'carried' | 'removed';
  position: number;
};

type Candidate = { entity_type: 'task' | 'followup'; entity_id: string; title: string; project_name: string | null; due_date: string | null };
type Carryover = { id: string; focus_date: string; entity_type: 'task' | 'followup'; entity_id: string; title: string; next_action: string };
type FocusData = { items: FocusItem[]; candidates: Candidate[]; carryover: Carryover[] };

function itemHref(type: string, id: string) {
  return type === 'task' ? `/tasks/${id}` : `/followups?focus=${id}`;
}

export default function FocusPlan({ initialDay = 'today' }: { initialDay?: 'today' | 'tomorrow' }) {
  const [baseDate, setBaseDate] = useState('');
  const [day, setDay] = useState<'today' | 'tomorrow'>(initialDay);
  const [data, setData] = useState<FocusData | null>(null);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState('');
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const currentDate = useRef('');
  const currentQuery = useRef('');

  useEffect(() => { setBaseDate(format(new Date(), 'yyyy-MM-dd')); }, []);
  const date = baseDate && (day === 'today' ? baseDate : format(addDays(parseISO(baseDate), 1), 'yyyy-MM-dd'));

  const load = async (focusDate: string, search = '', resetDrafts = false) => {
    try {
      const response = await fetch(`/api/focus?date=${focusDate}&q=${encodeURIComponent(search)}`);
      if (!response.ok) throw new Error('Could not load focus plan');
      const result: FocusData = await response.json();
      if (currentDate.current !== focusDate || currentQuery.current !== search) return;
      setData(result);
      setDrafts((current) => Object.fromEntries(result.items.map((item) => [item.id, resetDrafts ? item.next_action : current[item.id] ?? item.next_action])));
      setError('');
    } catch { if (currentDate.current === focusDate && currentQuery.current === search) setError('Could not load your focus plan.'); }
  };

  useEffect(() => {
    currentDate.current = date;
    currentQuery.current = query;
    if (!date) return;
    const timeout = window.setTimeout(() => load(date, query), query ? 180 : 0);
    return () => window.clearTimeout(timeout);
  }, [date, query]);

  useEffect(() => { setData(null); setDrafts({}); }, [date]);

  const mutate = async (method: string, payload: object, id?: string) => {
    if (!date) return false;
    setBusy(true);
    try {
      const response = await fetch(id ? `/api/focus?id=${encodeURIComponent(id)}` : '/api/focus', {
        method, headers: { 'Content-Type': 'application/json' }, ...(method === 'DELETE' ? {} : { body: JSON.stringify(payload) }),
      });
      if (!response.ok) throw new Error((await response.json()).error || 'Could not update focus plan');
      await load(date, query, true);
      return true;
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not update focus plan'); return false; }
    finally { setBusy(false); }
  };

  const active = data?.items.filter((item) => item.state === 'active') || [];
  const finished = data?.items.filter((item) => item.state === 'completed' || item.state === 'carried') || [];
  const candidates = data?.candidates.filter((candidate) => !data.items.some((item) => item.entity_id === candidate.entity_id && item.entity_type === candidate.entity_type && item.state !== 'removed')) || [];
  const add = async () => {
    if (!selected) return;
    const [entity_type, entity_id] = selected.split(':');
    if (await mutate('POST', { date, entity_type, entity_id })) setSelected('');
  };

  return <section className="focus-plan" id="focus-plan">
    <div className="focus-heading">
      <div><h2><Target size={18} /> Focus plan <span>{active.length}/3</span></h2><p>{day === 'today' ? 'Today' : 'Tomorrow'}</p></div>
      <div className="focus-day-switch" role="group" aria-label="Plan day"><button type="button" className={day === 'today' ? 'active' : ''} onClick={() => { setDay('today'); setQuery(''); setSelected(''); }}>Today</button><button type="button" className={day === 'tomorrow' ? 'active' : ''} onClick={() => { setDay('tomorrow'); setQuery(''); setSelected(''); }}>Tomorrow</button></div>
    </div>
    {error && <p role="alert" className="work-error">{error}</p>}
    {!data && <p className="work-muted">Loading focus...</p>}
    <div className="focus-list">
      {active.map((item, index) => <div className="focus-item" key={item.id}>
        <span className="focus-rank">{index + 1}</span>
        <div className="focus-item-body">
          <div className="focus-item-title"><Link href={itemHref(item.entity_type, item.entity_id)}>{item.title}</Link><span>{item.project_name || (item.entity_type === 'task' ? 'Personal task' : 'Follow-up')}</span></div>
          <div className="focus-next-action"><input aria-label={`Next action for ${item.title}`} placeholder="Next concrete action" maxLength={300} value={drafts[item.id] ?? item.next_action} onChange={(event) => setDrafts((current) => ({ ...current, [item.id]: event.target.value }))} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); mutate('PUT', { id: item.id, next_action: drafts[item.id] ?? '' }); } }} /><button type="button" title="Save next action" aria-label={`Save next action for ${item.title}`} disabled={busy || (drafts[item.id] ?? '') === item.next_action} onClick={() => mutate('PUT', { id: item.id, next_action: drafts[item.id] ?? '' })}><Save size={15} /></button></div>
        </div>
        <div className="focus-item-actions">
          <button type="button" title="Move up" aria-label={`Move ${item.title} up`} disabled={busy || index === 0} onClick={() => mutate('PUT', { id: item.id, position: active[index - 1].position })}><ArrowUp size={15} /></button>
          <button type="button" title="Move down" aria-label={`Move ${item.title} down`} disabled={busy || index === active.length - 1} onClick={() => mutate('PUT', { id: item.id, position: active[index + 1].position })}><ArrowDown size={15} /></button>
          <button type="button" title={item.entity_type === 'task' ? 'Complete task' : 'Resolve follow-up'} aria-label={`${item.entity_type === 'task' ? 'Complete task' : 'Resolve follow-up'}: ${item.title}`} disabled={busy} onClick={() => mutate('PUT', { id: item.id, complete_entity: true })}><Check size={17} /></button>
          <button type="button" title="Remove from plan" aria-label={`Remove ${item.title} from plan`} disabled={busy} onClick={() => mutate('DELETE', {}, item.id)}><X size={15} /></button>
        </div>
      </div>)}
      {data && !active.length && <p className="focus-empty">Choose up to three commitments for {day}.</p>}
    </div>
    {data && active.length < 3 && <>
      {!!data.carryover.length && <div className="focus-carryover"><strong>Unfinished from earlier</strong>{data.carryover.map((item) => <div key={item.id}><span>{item.title} <small>· {item.focus_date}</small></span><button type="button" disabled={busy} onClick={() => mutate('POST', { date, entity_type: item.entity_type, entity_id: item.entity_id, source_focus_id: item.id })}><CornerDownRight size={14} /> Carry</button></div>)}</div>}
      <div className="focus-add"><input aria-label="Find work for focus plan" placeholder="Find a task or follow-up" value={query} onChange={(event) => { setQuery(event.target.value); setSelected(''); }} /><select aria-label="Choose focus item" value={selected} onChange={(event) => setSelected(event.target.value)}><option value="">Select work</option>{candidates.map((candidate) => <option key={`${candidate.entity_type}:${candidate.entity_id}`} value={`${candidate.entity_type}:${candidate.entity_id}`}>{candidate.title} {candidate.project_name ? `· ${candidate.project_name}` : ''}</option>)}</select><button type="button" title="Add to focus plan" aria-label="Add to focus plan" disabled={!selected || busy} onClick={add}><Plus size={17} /></button></div>
    </>}
    {!!finished.length && <details className="focus-finished"><summary>{finished.length} finished or carried</summary>{finished.map((item) => <div key={item.id}><Link href={itemHref(item.entity_type, item.entity_id)}>{item.title}</Link><span>{item.state === 'completed' ? 'Completed' : 'Carried'}</span></div>)}</details>}
  </section>;
}