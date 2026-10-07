'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Plus, X } from 'lucide-react';
import { requestJson, useUnsavedChanges } from '@/lib/client';
export default function MeetingOutcomeForm({ event, onClose }: { event: { id: string; title: string }; onClose: () => void }) {
  const [type, setType] = useState('note');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [date, setDate] = useState('');
  const [waiting, setWaiting] = useState('');
  const [visibility, setVisibility] = useState('private');
  const [status, setStatus] = useState('');
  const [href, setHref] = useState('');
  const [busy, setBusy] = useState(false);
  useUnsavedChanges(!!title || !!content);
  return <div className="inline-form"><div className="entity-card-header"><h2 style={{ fontSize: '1rem' }}>{event.title}</h2><button className="notification-trigger" title="Close" onClick={() => { if (!title && !content || confirm('Discard this outcome draft?')) onClose(); }}><X size={16} /></button></div>
    <div className="tabs">{['note', 'task', 'followup'].map((value) => <button type="button" key={value} className={`tab ${type === value ? 'active' : ''}`} onClick={() => setType(value)}>{value === 'followup' ? 'Follow-up' : value === 'task' ? 'Task' : 'Meeting note'}</button>)}</div>
    <form onSubmit={async (submission) => { submission.preventDefault(); setBusy(true); setStatus(''); try { const result = await requestJson('/api/calendar/outcomes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ event_id: event.id, type, title, content, date, waiting_on: waiting, visibility }) }); setHref(result.href); setTitle(''); setContent(''); setStatus('Created'); } catch (error) { setStatus(String(error)); } finally { setBusy(false); } }}>
      <label>Title<input className="form-input" required value={title} onChange={(change) => setTitle(change.target.value)} /></label>
      <label>{type === 'note' ? 'Decisions and notes' : 'Context'}<textarea className="form-input" value={content} onChange={(change) => setContent(change.target.value)} rows={4} /></label>
      {type === 'note' ? <label>Visibility<select className="form-select" value={visibility} onChange={(change) => setVisibility(change.target.value)}><option value="private">Private</option><option value="shared">Shared</option></select></label> : <label>Due date<input className="form-input" type="date" value={date} onChange={(change) => setDate(change.target.value)} /></label>}
      {type === 'followup' && <label>Waiting on<input className="form-input" required value={waiting} onChange={(change) => setWaiting(change.target.value)} /></label>}
      <button className="btn-capture" disabled={busy}><Plus size={16} /> {busy ? 'Saving...' : 'Create outcome'}</button>
    </form>{status && <p role="status">{status} {href && <Link href={href}>Open outcome</Link>}</p>}
  </div>;
}