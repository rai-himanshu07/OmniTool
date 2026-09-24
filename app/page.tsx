'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { ArrowRight, CalendarDays, ClipboardCheck, Inbox, Send } from 'lucide-react';
import FocusPlan from '@/components/FocusPlan';

interface AttentionItem {
  id: string;
  title: string;
  subtitle: string;
  severity: 'critical' | 'high' | 'medium';
  related_entity_type: 'task' | 'project' | 'followup';
  related_entity_id: string;
}

interface DashboardData {
  metrics: {
    overdue_tasks_count: number;
    due_today_tasks_count: number;
    raw_inbox_count: number;
    active_followups_count: number;
    projects_summary: { amber: number; red: number };
  };
  attentionItems: AttentionItem[];
  todayTasks: { id: string; title: string; project_name?: string }[];
  todayEvents: { id: string; title: string; start_time: string }[];
  activeFollowups: { id: string; title: string; waiting_on_person: string; waiting_days: number }[];
}

function attentionHref(item: AttentionItem) {
  if (item.related_entity_type === 'task') return `/tasks/${item.related_entity_id}`;
  if (item.related_entity_type === 'project') return `/projects/${item.related_entity_id}`;
  return `/followups?focus=${item.related_entity_id}`;
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [captureText, setCaptureText] = useState('');
  const [capturing, setCapturing] = useState(false);

  const refresh = async () => {
    try {
      const response = await fetch('/api/dashboard');
      if (!response.ok) throw new Error('Could not load dashboard');
      setData(await response.json());
      setError('');
    } catch {
      setError('Could not load your work. Try refreshing the page.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    window.addEventListener('omnitool:refresh', refresh);
    return () => window.removeEventListener('omnitool:refresh', refresh);
  }, []);

  const capture = async (event: FormEvent) => {
    event.preventDefault();
    if (!captureText.trim()) return;
    setCapturing(true);
    try {
      const response = await fetch('/api/inbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: captureText.trim(), source: 'dashboard' }),
      });
      if (!response.ok) throw new Error('Could not save capture');
      setCaptureText('');
      setError('');
      window.dispatchEvent(new Event('omnitool:captured'));
    } catch {
      setError('Capture was not saved. Please try again.');
    } finally {
      setCapturing(false);
    }
  };

  const today = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  const attention = [...(data?.attentionItems || [])].sort((a, b) =>
    ({ critical: 0, high: 1, medium: 2 })[a.severity] - ({ critical: 0, high: 1, medium: 2 })[b.severity]
  ).slice(0, 6);
  const highlighted = new Set(attention.map((item) => item.related_entity_type === 'followup' ? item.related_entity_id : ''));
  const otherFollowups = data?.activeFollowups.filter((item) => !highlighted.has(item.id)).slice(0, 4) || [];

  return (
    <div className="work-dashboard">
      <header className="work-heading">
        <div><p className="work-date">{today}</p><h1>Today</h1></div>
        <Link className="btn-secondary work-review" href="/review"><ClipboardCheck size={16} /> Day review</Link>
      </header>

      <form className="work-capture" onSubmit={capture}>
        <Inbox size={19} aria-hidden="true" />
        <input aria-label="Capture a thought" placeholder="Capture a thought or commitment..." value={captureText}
          onChange={(event) => setCaptureText(event.target.value)} disabled={capturing} />
        <button type="submit" aria-label="Save to Inbox" title="Save to Inbox" disabled={capturing || !captureText.trim()}><Send size={18} /></button>
      </form>
      {error && <p role="alert" className="work-error">{error}</p>}
      {loading && <p className="work-muted">Loading your work...</p>}

      {data && (
        <>
          <div className="work-signals">
            <Link href="/my-work"><strong>{data.metrics.overdue_tasks_count}</strong><span>Overdue</span></Link>
            <Link href="/my-work"><strong>{data.metrics.due_today_tasks_count}</strong><span>Due today</span></Link>
            <Link href="/inbox"><strong>{data.metrics.raw_inbox_count}</strong><span>In Inbox</span></Link>
            <Link href="/projects" className="work-signals-context">
              {data.metrics.projects_summary.red + data.metrics.projects_summary.amber} {data.metrics.projects_summary.red + data.metrics.projects_summary.amber === 1 ? 'project needs' : 'projects need'} attention <ArrowRight size={14} />
            </Link>
          </div>

          <FocusPlan />

          <div className="work-columns">
            <section className="work-section">
              <div className="work-section-heading"><h2>Needs attention</h2><Link href="/my-work">All work <ArrowRight size={14} /></Link></div>
              {attention.length ? attention.map((item) => (
                <Link href={attentionHref(item)} className="work-row" key={item.id}>
                  <span className={`work-severity ${item.severity}`} aria-hidden="true" />
                  <span className="work-row-content"><strong>{item.title}</strong><small>{item.subtitle}</small></span>
                  <ArrowRight size={16} aria-hidden="true" />
                </Link>
              )) : <p className="work-muted">Nothing urgent needs attention.</p>}
            </section>

            <div className="work-side">
              <section className="work-section">
                <div className="work-section-heading"><h2>On your schedule</h2><Link href="/calendar">Calendar <ArrowRight size={14} /></Link></div>
                {data.todayEvents.map((event) => (
                  <Link href="/calendar" className="work-row" key={event.id}>
                    <CalendarDays size={16} aria-hidden="true" /><span className="work-row-content"><strong>{event.title}</strong><small>{new Date(event.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</small></span>
                  </Link>
                ))}
                {data.todayTasks.map((task) => (
                  <Link href={`/tasks/${task.id}`} className="work-row" key={task.id}>
                    <span className="work-task-mark" aria-hidden="true" /><span className="work-row-content"><strong>{task.title}</strong><small>{task.project_name || 'Personal'}</small></span>
                  </Link>
                ))}
                {!data.todayEvents.length && !data.todayTasks.length && <p className="work-muted">Nothing else scheduled today.</p>}
              </section>

              {otherFollowups.length > 0 && <section className="work-section">
                <div className="work-section-heading"><h2>Waiting on others</h2><Link href="/followups">Follow-ups <ArrowRight size={14} /></Link></div>
                {otherFollowups.map((item) => (
                  <Link href={`/followups?focus=${item.id}`} className="work-row" key={item.id}>
                    <span className="work-row-content"><strong>{item.title}</strong><small>{item.waiting_on_person} · {item.waiting_days}d waiting</small></span>
                  </Link>
                ))}
              </section>}
            </div>
          </div>
        </>
      )}
    </div>
  );
}