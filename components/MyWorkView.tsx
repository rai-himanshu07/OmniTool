'use client';

import React, { useState, useEffect } from 'react';
import { 
  CheckSquare, 
  MessageSquare, 
  Calendar as CalendarIcon, 
  RefreshCw, 
  Inbox, 
  AlertCircle,
  Clock,
  CheckCircle2,
  MapPin,
  ListTodo
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import Link from 'next/link';

type Task = {
  id: string;
  title: string;
  project_name: string | null;
  priority: 'low' | 'medium' | 'high' | 'critical';
  due_date: string | null;
  status: string;
};

type FollowUp = {
  id: string;
  title: string;
  project_name: string | null;
  person: string;
  priority: string;
  waiting_days: number;
  category: string;
  status: string;
};

type Event = {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  location: string | null;
  project_id: string | null;
};

type Recurring = {
  id: string;
  title: string;
  frequency: string;
  next_due_date: string;
};

type Summary = {
  tasks_count: number;
  followups_count: number;
  events_count: number;
  recurring_count: number;
  overdue_count: number;
};

type MyWorkData = {
  tasks: Task[];
  followups: FollowUp[];
  events: Event[];
  recurring: Recurring[];
  inbox_count: number;
  summary: Summary;
};

export default function MyWorkView() {
  const [data, setData] = useState<MyWorkData | null>(null);
  const [period, setPeriod] = useState<'today' | 'this_week' | 'overdue' | 'all'>('today');
  const [loading, setLoading] = useState(true);

  const fetchWorkData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/my-work?period=${period}`);
      const json = await res.json();
      setData(json);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkData();
  }, [period]);

  const handleToggleTask = async (taskId: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'done' ? 'open' : 'done';
    try {
      await fetch('/api/tasks', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: taskId, status: nextStatus })
      });
      fetchWorkData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleResolveFollowUp = async (id: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'resolved' ? 'waiting' : 'resolved';
    try {
      await fetch('/api/followups', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: nextStatus })
      });
      fetchWorkData();
    } catch (err) {
      console.error(err);
    }
  };

  if (!data && loading) {
    return <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Loading work items...</div>;
  }

  if (!data) {
    return <div className="empty-state">Failed to load data.</div>;
  }

  const { tasks, followups, events, recurring, inbox_count, summary } = data;

  return (
    <div>
      <div className="page-header">
        <h1>My Work</h1>
        <p>Cross-entity aggregation of tasks, follow-ups, events, and recurring items.</p>
      </div>

      {/* Summary Bar */}
      <div className="stats-grid metrics-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        <div className="stat-card metric-card">
          <div className="metric-icon" style={{ background: 'var(--emerald-bg)', color: 'var(--emerald)' }}><CheckSquare size={24} /></div>
          <div>
            <div className="stat-value metric-value">{summary.tasks_count}</div>
            <div className="stat-label metric-label">Tasks</div>
          </div>
        </div>
        <div className="stat-card metric-card">
          <div className="metric-icon" style={{ background: 'var(--purple-bg)', color: 'var(--purple)' }}><MessageSquare size={24} /></div>
          <div>
            <div className="stat-value metric-value">{summary.followups_count}</div>
            <div className="stat-label metric-label">Follow-ups</div>
          </div>
        </div>
        <div className="stat-card metric-card">
          <div className="metric-icon" style={{ background: 'var(--amber-bg)', color: 'var(--amber)' }}><CalendarIcon size={24} /></div>
          <div>
            <div className="stat-value metric-value">{summary.events_count}</div>
            <div className="stat-label metric-label">Meetings</div>
          </div>
        </div>
        <div className="stat-card metric-card">
          <div className="metric-icon" style={{ background: 'rgba(99, 102, 241, 0.12)', color: 'var(--primary)' }}><RefreshCw size={24} /></div>
          <div>
            <div className="stat-value metric-value">{summary.recurring_count}</div>
            <div className="stat-label metric-label">Recurring</div>
          </div>
        </div>
        <div className="stat-card metric-card">
          <div className="metric-icon" style={{ background: 'var(--rose-bg)', color: 'var(--rose)' }}><AlertCircle size={24} /></div>
          <div>
            <div className="stat-value metric-value">{summary.overdue_count}</div>
            <div className="stat-label metric-label">Overdue</div>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="tabs">
        {(['today', 'this_week', 'overdue', 'all'] as const).map((p) => (
          <button
            key={p}
            className={`tab ${period === p ? 'active' : ''}`}
            onClick={() => setPeriod(p)}
          >
            {p === 'today' ? 'Today' : p === 'this_week' ? 'This Week' : p === 'overdue' ? 'Overdue' : 'All'}
          </button>
        ))}
      </div>

      {loading && data && (
        <div style={{ opacity: 0.5, marginBottom: '1rem', color: 'var(--text-muted)' }}>Refreshing...</div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        
        {/* Inbox Section */}
        {inbox_count > 0 && (
          <section>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
              <Inbox size={20} className="text-primary" />
              <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Inbox</h2>
              <span className="badge badge-red">{inbox_count}</span>
            </div>
            <div className="entity-list">
              <div className="entity-card" style={{ borderLeft: '4px solid var(--rose)' }}>
                <div className="entity-card-header">
                  <h4 className="entity-card-title">You have {inbox_count} pending items in your inbox to process.</h4>
                  <Link href="/inbox" className="btn-secondary" style={{ textDecoration: 'none', display: 'inline-block' }}>
                    Process Inbox
                  </Link>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Tasks Section */}
        <section>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            <ListTodo size={20} className="text-primary" style={{ color: 'var(--emerald)' }} />
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Tasks</h2>
            <span className="badge badge-green">{tasks.length}</span>
          </div>
          {tasks.length === 0 ? (
            <div className="empty-state card" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>No tasks for this period.</div>
          ) : (
            <div className="entity-list">
              {tasks.map(task => (
                <div className="entity-card" key={task.id}>
                  <div className="entity-card-header">
                    <Link href={`/tasks/${task.id}`} style={{ textDecoration: 'none' }}>
                      <h4 className="entity-card-title" style={{ textDecoration: task.status === 'done' ? 'line-through' : 'none', color: task.status === 'done' ? 'var(--text-muted)' : 'inherit' }}>
                        {task.title}
                      </h4>
                    </Link>
                    <button onClick={() => handleToggleTask(task.id, task.status)} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <CheckCircle2 size={16} /> Mark Done
                    </button>
                  </div>
                  <div className="entity-card-meta">
                    <div className="meta-item">
                      <span className={`health-dot ${task.priority === 'critical' || task.priority === 'high' ? 'red' : task.priority === 'medium' ? 'amber' : 'green'}`} />
                    </div>
                    {task.project_name && (
                      <div className="meta-item">
                        <span className="badge badge-purple">{task.project_name}</span>
                      </div>
                    )}
                    {task.due_date && (
                      <div className="meta-item">
                        <Clock size={14} /> {format(parseISO(task.due_date), 'MMM d, yyyy')}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Follow-ups Section */}
        <section>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            <MessageSquare size={20} className="text-primary" style={{ color: 'var(--purple)' }} />
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Follow-ups</h2>
            <span className="badge badge-purple">{followups.length}</span>
          </div>
          {followups.length === 0 ? (
            <div className="empty-state card" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>No follow-ups for this period.</div>
          ) : (
            <div className="entity-list">
              {followups.map(followup => (
                <div className="entity-card" key={followup.id}>
                  <div className="entity-card-header">
                    <h4 className="entity-card-title" style={{ textDecoration: followup.status === 'resolved' ? 'line-through' : 'none' }}>
                      {followup.title}
                    </h4>
                    <button onClick={() => handleResolveFollowUp(followup.id, followup.status)} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <CheckCircle2 size={16} /> Mark Resolved
                    </button>
                  </div>
                  <div className="entity-card-meta">
                    <div className="meta-item">
                      <span className="tag-person badge badge-amber">@{followup.person}</span>
                    </div>
                    <div className="meta-item">
                      <span className={`waiting-pill ${followup.waiting_days > 7 ? 'overdue' : followup.waiting_days > 3 ? 'aging' : 'fresh'}`}>
                        <Clock size={14} /> Waiting {followup.waiting_days}d
                      </span>
                    </div>
                    {followup.category && (
                      <div className="meta-item">
                        <span className="badge badge-green">{followup.category}</span>
                      </div>
                    )}
                    {followup.project_name && (
                      <div className="meta-item">
                        <span className="badge badge-purple">{followup.project_name}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Calendar Events Section */}
        <section>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            <CalendarIcon size={20} className="text-primary" style={{ color: 'var(--amber)' }} />
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Calendar Events</h2>
            <span className="badge badge-amber">{events.length}</span>
          </div>
          {events.length === 0 ? (
            <div className="empty-state card" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>No events for this period.</div>
          ) : (
            <div className="entity-list">
              {events.map(event => (
                <div className="entity-card" key={event.id}>
                  <div className="entity-card-header">
                    <h4 className="entity-card-title">{event.title}</h4>
                    {event.project_id && (
                      <Link href={`/projects/${event.project_id}`} className="btn-secondary" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        View Project
                      </Link>
                    )}
                  </div>
                  <div className="entity-card-meta">
                    <div className="meta-item">
                      <Clock size={14} /> {format(parseISO(event.start_time), 'MMM d, h:mm a')} - {format(parseISO(event.end_time), 'h:mm a')}
                    </div>
                    {event.location && (
                      <div className="meta-item">
                        <MapPin size={14} /> {event.location}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Recurring Items Section */}
        <section>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            <RefreshCw size={20} className="text-primary" />
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Upcoming cadence</h2>
            <span className="badge badge-purple">{recurring.length}</span>
            <Link href="/cadence" style={{ marginLeft: 'auto', color: 'var(--primary)', fontSize: '0.85rem' }}>Manage recurring work</Link>
          </div>
          {recurring.length === 0 ? (
            <div className="empty-state" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>No recurring work scheduled this week.</div>
          ) : (
            <div className="entity-list">
              {recurring.map(item => (
                <div className="entity-card" key={item.id}>
                  <div className="entity-card-header">
                    <h4 className="entity-card-title">{item.title}</h4>
                  </div>
                  <div className="entity-card-meta">
                    <div className="meta-item">
                      <RefreshCw size={14} /> {item.frequency}
                    </div>
                    <div className="meta-item">
                      <Clock size={14} /> Next due: {format(parseISO(item.next_due_date), 'MMM d, yyyy')}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

      </div>
    </div>
  );
}
