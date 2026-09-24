'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import FocusPlan from '@/components/FocusPlan';
import {
  ClipboardCheck,
  CheckCircle2,
  Clock,
  CalendarDays,
  Inbox,
  ArrowRight,
  RefreshCw,
  Sun,
  Moon,
  CalendarClock,
  Check,
  Sparkles
} from 'lucide-react';

interface ReviewData {
  completed_today: any[];
  incomplete_tasks: any[];
  new_captures_today: any[];
  pending_followups: any[];
  tomorrow_tasks: any[];
  tomorrow_events: any[];
  reviewed_today: boolean;
  summary: {
    completed_count: number;
    incomplete_count: number;
    captures_count: number;
    followups_count: number;
    tomorrow_tasks_count: number;
    tomorrow_events_count: number;
  };
}

export default function ReviewView() {
  const [period, setPeriod] = useState<'day' | 'week'>('day');
  return <div>
    <div className="tabs" role="tablist" aria-label="Review period" style={{ marginBottom: '1.5rem' }}>
      <button type="button" role="tab" aria-selected={period === 'day'} className={`tab ${period === 'day' ? 'active' : ''}`} onClick={() => setPeriod('day')}>Day</button>
      <button type="button" role="tab" aria-selected={period === 'week'} className={`tab ${period === 'week' ? 'active' : ''}`} onClick={() => setPeriod('week')}>Week</button>
    </div>
    {period === 'day' ? <DailyReview /> : <WeeklyReview />}
  </div>;
}

function DailyReview() {
  const [data, setData] = useState<ReviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeStep, setActiveStep] = useState(0);
  const [captureText, setCaptureText] = useState('');
  const [finishing, setFinishing] = useState(false);

  const loadReview = () => {
    setLoading(true);
    fetch('/api/review/daily')
      .then(r => r.json())
      .then(d => setData(d))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadReview();
  }, []);

  const handleReschedule = async (taskId: string) => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    await fetch(`/api/tasks/${taskId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ due_date: tomorrow.toISOString().split('T')[0] }),
    });
    loadReview();
  };

  const handleMarkDone = async (taskId: string) => {
    await fetch(`/api/tasks/${taskId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'done' }),
    });
    loadReview();
  };

  const handleResolveFollowup = async (id: string) => {
    await fetch('/api/followups', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status: 'resolved' }),
    });
    loadReview();
  };

  const handleSnoozeFollowup = async (id: string) => {
    const snoozed = new Date();
    snoozed.setDate(snoozed.getDate() + 2);
    await fetch('/api/followups', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, expected_date: snoozed.toISOString().split('T')[0] }),
    });
    loadReview();
  };

  const handleCapture = async () => {
    if (!captureText.trim()) return;
    await fetch('/api/inbox', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: captureText.trim(), source: 'daily_review' }),
    });
    setCaptureText('');
    loadReview();
  };

  const handleFinishReview = async () => {
    setFinishing(true);
    try {
      await fetch('/api/review/daily', { method: 'POST' });
      loadReview();
    } finally {
      setFinishing(false);
    }
  };

  if (loading) {
    return (
      <div className="page-header">
        <h1>Day Review</h1>
        <p>Loading your day summary...</p>
      </div>
    );
  }

  const summary = data?.summary;
  const steps = [
    {
      title: 'Completed Work',
      icon: CheckCircle2,
      count: summary?.completed_count ?? 0,
      items: data?.completed_today || [],
      color: 'var(--success)',
      emptyText: 'No tasks completed today',
      kind: 'completed' as const
    },
    {
      title: 'Incomplete Tasks',
      icon: Clock,
      count: summary?.incomplete_count ?? 0,
      items: data?.incomplete_tasks || [],
      color: 'var(--warning)',
      emptyText: 'All tasks completed — great work!',
      kind: 'incomplete' as const
    },
    {
      title: 'New Captures',
      icon: Inbox,
      count: summary?.captures_count ?? 0,
      items: data?.new_captures_today || [],
      color: 'var(--accent-primary)',
      emptyText: 'No new captures today',
      kind: 'capture' as const
    },
    {
      title: 'Pending Follow-ups',
      icon: RefreshCw,
      count: summary?.followups_count ?? 0,
      items: data?.pending_followups || [],
      color: 'var(--danger)',
      emptyText: 'No pending follow-ups',
      kind: 'followup' as const
    },
    {
      title: 'Tomorrow\'s Workload',
      icon: Sun,
      count: (summary?.tomorrow_tasks_count ?? 0) + (summary?.tomorrow_events_count ?? 0),
      items: [...(data?.tomorrow_tasks || []), ...(data?.tomorrow_events || [])],
      color: 'var(--accent-secondary)',
      emptyText: 'Nothing scheduled for tomorrow',
      kind: 'tomorrow' as const
    },
  ];

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1><Moon size={24} style={{ marginRight: '0.5rem', verticalAlign: 'middle' }} />Day Review</h1>
          <p>Review your day, reschedule incomplete work, and prepare for tomorrow</p>
        </div>
        <button
          className="btn-capture"
          onClick={handleFinishReview}
          disabled={finishing}
          style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: data?.reviewed_today ? 'var(--emerald-gradient)' : undefined }}
        >
          <Check size={16} />
          {data?.reviewed_today ? 'Reviewed today ✓ (review again)' : 'Finish review'}
        </button>
      </div>

      {/* Quick capture */}
      <div className="card" style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
        <input
          type="text"
          className="input-field"
          placeholder="Capture a new thought before you close the day..."
          value={captureText}
          onChange={(e) => setCaptureText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleCapture()}
        />
        <button className="btn-secondary" onClick={handleCapture}>Capture</button>
      </div>

      {/* Summary Cards */}
      <div className="review-summary" style={{ marginBottom: '2rem' }}>
        <div className="review-summary-item">
          <div className="review-summary-value" style={{ color: 'var(--success)' }}>{summary?.completed_count ?? 0}</div>
          <div className="review-summary-label">Completed</div>
        </div>
        <div className="review-summary-item">
          <div className="review-summary-value" style={{ color: 'var(--warning)' }}>{summary?.incomplete_count ?? 0}</div>
          <div className="review-summary-label">Incomplete</div>
        </div>
        <div className="review-summary-item">
          <div className="review-summary-value" style={{ color: 'var(--accent-primary)' }}>{summary?.captures_count ?? 0}</div>
          <div className="review-summary-label">Captures</div>
        </div>
        <div className="review-summary-item">
          <div className="review-summary-value" style={{ color: 'var(--danger)' }}>{summary?.followups_count ?? 0}</div>
          <div className="review-summary-label">Follow-ups</div>
        </div>
        <div className="review-summary-item">
          <div className="review-summary-value">{(summary?.tomorrow_tasks_count ?? 0) + (summary?.tomorrow_events_count ?? 0)}</div>
          <div className="review-summary-label">Tomorrow</div>
        </div>
      </div>

      {/* Review Steps */}
      <FocusPlan initialDay="tomorrow" />
      <div className="tabs" style={{ marginBottom: '1.5rem' }}>
        {steps.map((step, idx) => {
          const Icon = step.icon;
          return (
            <button
              key={idx}
              className={`tab ${activeStep === idx ? 'active' : ''}`}
              onClick={() => setActiveStep(idx)}
            >
              <Icon size={14} style={{ marginRight: '0.3rem' }} />
              {step.title} ({step.count})
            </button>
          );
        })}
      </div>

      {/* Active Step Content */}
      <div className="review-step">
        <div className="review-step-header">
          <div className="review-step-number" style={{ background: steps[activeStep].color }}>{activeStep + 1}</div>
          <h3 className="review-step-title">{steps[activeStep].title}</h3>
          <span className="badge" style={{ marginLeft: 'auto' }}>{steps[activeStep].count} items</span>
        </div>

        {steps[activeStep].items.length > 0 ? (
          <div className="entity-list">
            {steps[activeStep].items.map((item: any, idx: number) => (
              <div key={idx} className="entity-card" style={{ padding: '0.625rem 0.75rem', cursor: 'default' }}>
                <div className="entity-card-header">
                  <h4 className="entity-card-title">{item.title || item.content || 'Untitled'}</h4>
                  {item.status && <span className="badge">{item.status}</span>}
                  {item.priority && <span className={`badge badge-${item.priority}`}>{item.priority}</span>}
                </div>
                {item.project_name && (
                  <div className="entity-card-meta">
                    <span className="meta-item">{item.project_name}</span>
                  </div>
                )}
                {item.waiting_on_person && (
                  <div className="entity-card-meta">
                    <span className="tag-person">{item.waiting_on_person}</span>
                    {item.waiting_days && <span className="waiting-pill aging">{item.waiting_days}d waiting</span>}
                  </div>
                )}

                {steps[activeStep].kind === 'incomplete' && (
                  <div className="entity-card-meta" style={{ marginTop: '0.5rem', gap: '0.5rem' }}>
                    <button className="btn-secondary" style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }} onClick={() => handleReschedule(item.id)}>
                      <CalendarClock size={12} /> Reschedule to tomorrow
                    </button>
                    <button className="btn-secondary" style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }} onClick={() => handleMarkDone(item.id)}>
                      <Check size={12} /> Mark done
                    </button>
                  </div>
                )}

                {steps[activeStep].kind === 'followup' && (
                  <div className="entity-card-meta" style={{ marginTop: '0.5rem', gap: '0.5rem' }}>
                    <button className="btn-secondary" style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem' }} onClick={() => handleResolveFollowup(item.id)}>
                      Resolve
                    </button>
                    <button className="btn-secondary" style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem' }} onClick={() => handleSnoozeFollowup(item.id)}>
                      Snooze 2 days
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state" style={{ padding: '2rem' }}>
            <p className="empty-description">{steps[activeStep].emptyText}</p>
          </div>
        )}
      </div>
    </div>
  );
}

interface WeeklyItem {
  id: string;
  title: string;
  date: string | null;
  waiting_on_person?: string;
}

interface WeeklyData {
  week: { start: string; end: string; nextEnd: string };
  reviewed: { wins: string; risks: string; next_week: string; completed_at: string | null } | null;
  completed: WeeklyItem[];
  due: WeeklyItem[];
  followups: WeeklyItem[];
  upcoming: WeeklyItem[];
  meetings: WeeklyItem[];
}

type WeeklyDraft = { wins: string; risks: string; next_week: string };

function WeeklyReview() {
  const [data, setData] = useState<WeeklyData | null>(null);
  const [canEdit, setCanEdit] = useState(false);
  const [wins, setWins] = useState('');
  const [risks, setRisks] = useState('');
  const [nextWeek, setNextWeek] = useState('');
  const [completedAt, setCompletedAt] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [draft, setDraft] = useState<WeeklyDraft | null>(null);

  useEffect(() => {
    fetch('/api/me').then((response) => response.json()).then((account) => setCanEdit(account.role === 'admin' || account.role === 'member')).catch(() => undefined);
    fetch('/api/review/weekly').then(async (response) => {
      if (!response.ok) throw new Error('Could not load weekly review');
      return response.json();
    }).then((review: WeeklyData) => {
      setData(review);
      setWins(review.reviewed?.wins || '');
      setRisks(review.reviewed?.risks || '');
      setNextWeek(review.reviewed?.next_week || '');
      setCompletedAt(review.reviewed?.completed_at || null);
    }).catch((error) => setStatus(error.message));
  }, []);

  const save = async (complete: boolean) => {
    setBusy(true);
    setStatus('');
    try {
      const response = await fetch('/api/review/weekly', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wins, risks, next_week: nextWeek, complete }) });
      if (!response.ok) throw new Error((await response.json()).error || 'Could not save review');
      const result = await response.json();
      if (complete) setCompletedAt(result.completed_at);
      setStatus(complete ? 'Weekly review completed.' : 'Draft saved.');
    } catch (error) { setStatus(error instanceof Error ? error.message : 'Could not save review'); }
    finally { setBusy(false); }
  };

  const suggest = async () => {
    setSuggesting(true);
    setDraft(null);
    setStatus('');
    try {
      const response = await fetch('/api/review/weekly/suggest', { method: 'POST' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not draft review');
      setDraft(result.draft);
    } catch (error) { setStatus(error instanceof Error ? error.message : 'Could not draft review'); }
    finally { setSuggesting(false); }
  };

  const applyDraft = () => {
    if (!draft) return;
    if ((draft.wins && wins || draft.risks && risks || draft.next_week && nextWeek) &&
        !confirm('Replace existing text in the review form with the suggested draft?')) return;
    setWins(draft.wins || wins);
    setRisks(draft.risks || risks);
    setNextWeek(draft.next_week || nextWeek);
    setDraft(null);
    setStatus('Draft added to the form. Review and save when ready.');
  };

  if (!data) return <div className="page-header"><h1>Week Review</h1><p role="status">{status || 'Loading week...'}</p></div>;

  const lists: { title: string; items: WeeklyItem[]; path: string; empty: string }[] = [
    { title: 'Completed this week', items: data.completed, path: '/tasks', empty: 'No completed tasks yet.' },
    { title: 'Due or overdue', items: data.due, path: '/tasks', empty: 'No open work due this week.' },
    { title: 'Waiting on others', items: data.followups, path: '/followups', empty: 'No outstanding follow-ups.' },
    { title: 'Next week’s tasks', items: data.upcoming, path: '/tasks', empty: 'No tasks scheduled next week.' },
    { title: 'Next week’s meetings', items: data.meetings, path: '/calendar', empty: 'No meetings on the calendar.' },
  ];

  return <div>
    <div className="page-header"><h1>Week Review</h1><p>Week of {data.week.start} · {completedAt ? `Reviewed ${new Date(completedAt).toLocaleString()}` : 'In progress'}</p></div>
    <div className="review-summary" style={{ marginBottom: '1.5rem' }}>
      {lists.map((list) => <div className="review-summary-item" key={list.title}><div className="review-summary-value">{list.items.length}</div><div className="review-summary-label">{list.title}</div></div>)}
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
      {lists.map((list) => <section key={list.title} style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '0.8rem' }}>
        <h2 style={{ fontSize: '1rem', marginBottom: '0.65rem' }}>{list.title}</h2>
        {list.items.length ? <div className="entity-list">{list.items.map((item) => <div key={item.id} className="work-row">
          <span className="work-row-content"><Link href={list.path === '/calendar' || list.path === '/followups' ? list.path : `${list.path}/${item.id}`}>{item.title}</Link><small>{item.date || 'No date'}{item.waiting_on_person ? ` · ${item.waiting_on_person}` : ''}</small></span>
        </div>)}</div> : <p className="work-muted">{list.empty}</p>}
      </section>)}
    </div>
    <section style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '1rem' }}>
      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
        <h2 style={{ fontSize: '1rem' }}>Your review</h2>
        {canEdit && <button className="btn-secondary" type="button" disabled={busy || suggesting} onClick={suggest}><Sparkles size={15} /> {suggesting ? 'Drafting...' : 'Draft with AI'}</button>}
      </div>
      {canEdit && <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>On request, up to 12 titles and dates from each list above are sent to your configured AI provider. Names in titles may be included; notes, contact fields and locations are not sent.</p>}
      {draft && <div style={{ borderLeft: '3px solid var(--emerald)', background: 'var(--bg-card)', padding: '0.75rem', marginBottom: '1rem' }}>
        <h3 style={{ fontSize: '0.95rem', marginBottom: '0.5rem' }}>Suggested draft</h3>
        <div style={{ display: 'grid', gap: '0.6rem', fontSize: '0.85rem', overflowWrap: 'anywhere', whiteSpace: 'pre-wrap' }}>
          <div><strong>Wins</strong><p>{draft.wins || '—'}</p></div>
          <div><strong>Risks &amp; blockers</strong><p>{draft.risks || '—'}</p></div>
          <div><strong>Next-week commitments</strong><p>{draft.next_week || '—'}</p></div>
        </div>
        <div className="form-actions"><button type="button" className="btn-secondary" onClick={() => setDraft(null)}>Dismiss</button><button type="button" className="btn-capture" onClick={applyDraft}>Use draft</button></div>
      </div>}
      <div className="form-row">
        <div className="form-group"><label className="form-label" htmlFor="week-wins">Wins</label><textarea id="week-wins" className="form-input" rows={4} maxLength={5000} readOnly={!canEdit} value={wins} onChange={(event) => setWins(event.target.value)} /></div>
        <div className="form-group"><label className="form-label" htmlFor="week-risks">Risks &amp; blockers</label><textarea id="week-risks" className="form-input" rows={4} maxLength={5000} readOnly={!canEdit} value={risks} onChange={(event) => setRisks(event.target.value)} /></div>
        <div className="form-group"><label className="form-label" htmlFor="week-plan">Next-week commitments</label><textarea id="week-plan" className="form-input" rows={4} maxLength={5000} readOnly={!canEdit} value={nextWeek} onChange={(event) => setNextWeek(event.target.value)} /></div>
      </div>
      {status && <p role="status" className="work-error">{status}</p>}
      {canEdit && <div className="form-actions"><button className="btn-secondary" type="button" disabled={busy || suggesting} onClick={() => save(false)}>Save draft</button><button className="btn-capture" type="button" disabled={busy || suggesting} onClick={() => save(true)}><Check size={16} /> {completedAt ? 'Update review' : 'Finish week review'}</button></div>}
    </section>
  </div>;
}
