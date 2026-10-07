'use client';

import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { format } from 'date-fns';
import { Clock, Plus, User, Check, AlertTriangle, Timer, Pencil, RotateCcw, Send, Target, FolderKanban, ArrowDownWideNarrow } from 'lucide-react';
import { useUnsavedChanges } from '@/lib/client';

interface Followup {
  id: string;
  title: string;
  waiting_on_person: string;
  waiting_on_person_id?: string;
  category: string;
  status: string;
  expected_date?: string;
  priority: string;
  project_id?: string;
  project_name?: string;
  notes?: string;
  tags_json?: string;
  waiting_days?: number;
  created_at: string;
}

interface Project {
  id: string;
  name: string;
}

const STATUS_TABS = [
  { value: '', label: 'All' },
  { value: 'waiting', label: 'Waiting' },
  { value: 'escalated', label: 'Escalated' },
  { value: 'resolved', label: 'Resolved' },
];

const SORT_OPTIONS = [
  { value: 'waiting_days_desc', label: 'Longest Wait' },
  { value: 'waiting_days_asc', label: 'Shortest Wait' },
  { value: 'expected_date_asc', label: 'Expected Date (earliest)' },
  { value: 'priority', label: 'Priority' },
];

export default function FollowupsView() {
  const searchParams = useSearchParams();
  const focusedId = searchParams.get('focus');
  const [followups, setFollowups] = useState<Followup[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [people, setPeople] = useState<{ id: string; name: string; active: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [focusFeedback, setFocusFeedback] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [sortBy, setSortBy] = useState('waiting_days_desc');

  // Form state
  const [title, setTitle] = useState('');
  const [waitingOnPerson, setWaitingOnPerson] = useState('');
  const [waitingOnPersonId, setWaitingOnPersonId] = useState('');
  const [category, setCategory] = useState('waiting_response');
  const [expectedDate, setExpectedDate] = useState('');
  const [priority, setPriority] = useState('high');
  const [projectId, setProjectId] = useState('');
  const [notes, setNotes] = useState('');
  const [tags, setTags] = useState('');
  useUnsavedChanges(showAddForm && (!!title || !!notes || !!waitingOnPerson));

  const editFollowup = (followup: Followup) => {
    setEditingId(followup.id);
    setTitle(followup.title);
    setWaitingOnPerson(followup.waiting_on_person);
    setWaitingOnPersonId(followup.waiting_on_person_id || '');
    setCategory(followup.category);
    setExpectedDate(followup.expected_date || '');
    setPriority(followup.priority);
    setProjectId(followup.project_id || '');
    setNotes(followup.notes || '');
    setTags(JSON.parse(followup.tags_json || '[]').join(', '));
    setShowAddForm(true);
  };

  const closeForm = () => {
    setShowAddForm(false);
    setEditingId(null);
    setTitle('');
    setWaitingOnPerson('');
    setWaitingOnPersonId('');
    setNotes('');
    setTags('');
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      const [fRes, pRes, peopleRes] = await Promise.all([
        fetch(`/api/followups?${params}`),
        fetch('/api/projects'),
        fetch('/api/people')
      ]);
      const fData = await fRes.json();
      const pData = await pRes.json();
      setFollowups(fData.followups || []);
      setProjects(pData.projects || []);
      setPeople((await peopleRes.json()).people || []);
    } catch (err) { setError('Could not load follow-ups. Please try again.'); console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, [statusFilter]);

  useEffect(() => {
    if (focusedId && !loading) document.getElementById(`followup-${focusedId}`)?.scrollIntoView({ block: 'center' });
  }, [focusedId, loading]);

  const handleAction = async (id: string, newStatus: string) => {
    try {
      const response = await fetch('/api/followups', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: newStatus })
      });
      if (!response.ok) throw new Error('Unable to update follow-up');
      setError('');
      fetchData();
    } catch (err) { setError('Could not update follow-up. Please try again.'); console.error(err); }
  };

  const handleNudge = async (id: string) => {
    try {
      const response = await fetch('/api/followups', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, nudge: true }),
      });
      if (!response.ok) throw new Error('Unable to record nudge');
      fetchData();
    } catch (err) { setError('Could not record nudge. Please try again.'); console.error(err); }
  };

  const addToFocus = async (id: string) => {
    try {
      const response = await fetch('/api/focus', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: format(new Date(), 'yyyy-MM-dd'), entity_type: 'followup', entity_id: id }) });
      const result = await response.json();
      setFocusFeedback(response.ok ? 'Added to today’s Focus Plan.' : result.error || 'Could not add to focus.');
    } catch { setFocusFeedback('Could not add to focus.'); }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !waitingOnPerson.trim()) return;
    try {
      const response = await fetch('/api/followups', {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(editingId ? { id: editingId } : {}),
          title: title.trim(), waiting_on_person: waitingOnPerson.trim(),
          waiting_on_person_id: waitingOnPersonId || null,
          category, expected_date: expectedDate || null,
          priority, project_id: projectId || null,
          notes: notes.trim(),
          tags: tags.split(',').map((tag) => tag.trim()).filter(Boolean)
        })
      });
      if (!response.ok) throw new Error('Unable to save follow-up');
      closeForm();
      fetchData();
    } catch (err) { setError('Could not save follow-up. Please try again.'); console.error(err); }
  };

  // Sort followups
  const sortedFollowups = [...followups].sort((a, b) => {
    switch (sortBy) {
      case 'waiting_days_desc': return (b.waiting_days || 0) - (a.waiting_days || 0);
      case 'waiting_days_asc': return (a.waiting_days || 0) - (b.waiting_days || 0);
      case 'expected_date_asc':
        if (!a.expected_date) return 1;
        if (!b.expected_date) return -1;
        return a.expected_date.localeCompare(b.expected_date);
      case 'priority':
        const pOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
        return (pOrder[a.priority] ?? 4) - (pOrder[b.priority] ?? 4);
      default: return 0;
    }
  });

  const getWaitingPillClass = (days: number) => {
    if (days >= 5) return 'overdue';
    if (days >= 2) return 'aging';
    return 'fresh';
  };

  const activeCount = followups.filter(f => f.status !== 'resolved').length;
  const escalatedCount = followups.filter(f => f.status === 'escalated').length;

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1>Follow-ups</h1>
          <p>{activeCount} active{escalatedCount > 0 ? ` • ${escalatedCount} escalated` : ''}</p>
        </div>
        <button className="btn btn-primary" onClick={() => { closeForm(); setShowAddForm(true); }}>
          <Plus size={16} /> New Follow-up
        </button>
      </div>
      {error && <p role="alert" className="work-error">{error}</p>}
      {focusFeedback && <p role="status" className="work-muted">{focusFeedback} <Link href="/#focus-plan">View plan</Link></p>}

      {showAddForm && (
        <form className="inline-form" onSubmit={handleCreate}>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Title</label>
              <input className="form-input" placeholder="What are you tracking?" value={title} onChange={e => setTitle(e.target.value)} required />
            </div>
            <div className="form-group">
              <label className="form-label">Waiting On</label>
              <input className="form-input" placeholder="Person or team" value={waitingOnPerson} onChange={e => { setWaitingOnPerson(e.target.value); setWaitingOnPersonId(''); }} required />
            </div>
            <div className="form-group"><label className="form-label">Directory person</label><select className="form-select" value={waitingOnPersonId} onChange={(event) => { const person = people.find((entry) => entry.id === event.target.value); setWaitingOnPersonId(event.target.value); if (person) setWaitingOnPerson(person.name); }}><option value="">Manual contact</option>{people.filter((person) => person.active || person.id === waitingOnPersonId).map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select></div>
            <div className="form-group">
              <label className="form-label">Category</label>
              <select className="form-select" value={category} onChange={e => setCategory(e.target.value)}>
                <option value="waiting_response">Waiting for Response</option>
                <option value="waiting_approval">Waiting for Approval</option>
                <option value="someone_does">Someone Else Acts</option>
                <option value="blocked">Blocked By External</option>
                <option value="i_promised">I Promised Someone</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Expected Date</label>
              <input className="form-input" type="date" value={expectedDate} onChange={e => setExpectedDate(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Priority</label>
              <select className="form-select" value={priority} onChange={e => setPriority(e.target.value)}>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Project</label>
              <select className="form-select" value={projectId} onChange={e => setProjectId(e.target.value)}>
                <option value="">None</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          </div>
          <div className="form-group" style={{ marginTop: '0.75rem' }}>
              <label className="form-label">Context / notes</label>
            <textarea className="form-input" placeholder="Context or conversation summary..." value={notes} onChange={e => setNotes(e.target.value)} rows={2} />
          </div>
          <div className="form-group"><label className="form-label">Tags</label><input className="form-input" placeholder="Comma-separated tags" value={tags} onChange={(e) => setTags(e.target.value)} /></div>
          <div className="form-actions">
            <button type="button" className="btn btn-secondary" onClick={closeForm}>Cancel</button>
            <button type="submit" className="btn btn-primary">{editingId ? 'Save changes' : 'Track Follow-up'}</button>
          </div>
        </form>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
        <div className="tabs">
          {STATUS_TABS.map(tab => (
            <button
              key={tab.value}
              className={`tab ${statusFilter === tab.value ? 'active' : ''}`}
              onClick={() => setStatusFilter(tab.value)}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <ArrowDownWideNarrow size={14} style={{ color: 'var(--text-muted)' }} />
          <select className="form-select" value={sortBy} onChange={e => setSortBy(e.target.value)} style={{ width: 'auto', fontSize: '0.8rem', padding: '0.3rem 0.5rem' }}>
            {SORT_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
          </select>
        </div>
      </div>

      {loading ? (
        <div style={{ color: 'var(--text-muted)', padding: '2rem', textAlign: 'center' }}>Loading follow-ups...</div>
      ) : sortedFollowups.length === 0 ? (
        <div className="empty-state">
          <Clock size={40} className="empty-icon" />
          <h3 className="empty-title">No follow-ups</h3>
          <p className="empty-description">{statusFilter ? 'No follow-ups match this filter' : 'Start tracking commitments'}</p>
        </div>
      ) : (
        <div className="entity-list">
          {sortedFollowups.map(f => {
            const waitDays = f.waiting_days || 0;
            const pillClass = getWaitingPillClass(waitDays);
            const isResolved = f.status === 'resolved';
            return (
              <div id={`followup-${f.id}`} key={f.id} className="entity-card" style={{ opacity: isResolved ? 0.6 : 1, borderLeft: focusedId === f.id ? '3px solid var(--accent-primary)' : f.status === 'escalated' ? '3px solid var(--danger)' : undefined }}>
                <div className="entity-card-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span className={`badge badge-${f.priority}`}>{f.priority}</span>
                    <h4 className="entity-card-title">{f.title}</h4>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span className={`waiting-pill ${pillClass}`}>
                      <Timer size={12} /> {waitDays}d
                    </span>
                    <span className={`badge ${f.status === 'escalated' ? 'badge-critical' : f.status === 'resolved' ? 'badge-low' : ''}`}>
                      {f.status}
                    </span>
                  </div>
                </div>
                <div className="entity-card-meta">
                  <span className="meta-item"><User size={12} /> <span className="tag-person">{f.waiting_on_person}</span></span>
                  <span className="meta-item">{f.category?.replace(/_/g, ' ')}</span>
                  {f.project_name && <span className="meta-item"><FolderKanban size={12} /> {f.project_name}</span>}
                  {f.expected_date && <span className="meta-item"><Clock size={12} /> Expected: {f.expected_date}</span>}
                </div>
                {f.notes && (
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>{f.notes}</div>
                )}
                {JSON.parse(f.tags_json || '[]').map((tag: string) => <span key={tag} className="badge" style={{ marginRight: '0.35rem' }}>{tag}</span>)}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.75rem' }}>
                  <button className="btn btn-sm btn-secondary" onClick={() => editFollowup(f)}>
                    <Pencil size={14} /> Edit
                  </button>
                  {isResolved ? (
                    <button className="btn btn-sm btn-secondary" onClick={() => handleAction(f.id, 'waiting')}>
                      <RotateCcw size={14} /> Reopen
                    </button>
                  ) : (
                    <>
                    <button className="btn btn-sm btn-secondary" onClick={() => addToFocus(f.id)} title="Add to today's Focus Plan"><Target size={14} /> Focus</button>
                    <button className="btn btn-sm btn-secondary" onClick={() => handleAction(f.id, 'resolved')}>
                      <Check size={14} /> Resolve
                    </button>
                    <button className="btn btn-sm btn-secondary" onClick={() => handleNudge(f.id)} title="Record a nudge and restart waiting time">
                      <Send size={14} /> Record nudge
                    </button>
                    {f.status !== 'escalated' && (
                      <button className="btn btn-sm btn-secondary" onClick={() => handleAction(f.id, 'escalated')} style={{ color: 'var(--danger)' }}>
                        <AlertTriangle size={14} /> Escalate
                      </button>
                    )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
