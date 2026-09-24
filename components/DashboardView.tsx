'use client';

import React from 'react';
import {
  AlertTriangle,
  Clock,
  CheckCircle2,
  Calendar,
  Layers,
  Inbox as InboxIcon,
  ArrowRight,
  UserCheck,
  Zap,
  Activity
} from 'lucide-react';
import { DashboardMetrics, AttentionItem } from '@/lib/services/attentionEngine';

interface DashboardViewProps {
  metrics?: DashboardMetrics;
  attentionItems: AttentionItem[];
  onNavigate: (view: any) => void;
  onRefresh: () => void;
}

export default function DashboardView({
  metrics,
  attentionItems,
  onNavigate,
  onRefresh
}: DashboardViewProps) {
  const handleTaskDone = async (taskId: string) => {
    try {
      await fetch('/api/tasks', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: taskId, status: 'done' })
      });
      onRefresh();
    } catch (err) {
      console.error('Failed to complete task:', err);
    }
  };

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
            <Zap size={16} color="var(--primary)" />
            <span style={{ fontSize: '0.82rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--primary)', fontWeight: 700 }}>
              Command Centre OS
            </span>
          </div>
          <h1 style={{ fontSize: '2.1rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.03em' }}>
            Operational Overview
          </h1>
        </div>
        <div style={{ background: 'var(--bg-surface)', padding: '0.5rem 1rem', borderRadius: 'var(--radius-full)', border: '1px solid var(--border-glass)', fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
          {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
        </div>
      </div>

      {/* Metrics Row */}
      <div className="metrics-grid">
        <div className="metric-card" style={{ borderColor: metrics?.overdue_tasks_count ? 'rgba(244, 63, 94, 0.5)' : undefined }}>
          <div className="metric-icon" style={{ background: 'var(--rose-gradient)', color: '#fff' }}>
            <AlertTriangle size={22} />
          </div>
          <div>
            <div className="metric-value" style={{ color: metrics?.overdue_tasks_count ? 'var(--rose)' : undefined }}>
              {metrics?.overdue_tasks_count || 0}
            </div>
            <div className="metric-label">Overdue Tasks</div>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon" style={{ background: 'var(--primary-gradient)', color: '#fff' }}>
            <CheckCircle2 size={22} />
          </div>
          <div>
            <div className="metric-value">{metrics?.due_today_tasks_count || 0}</div>
            <div className="metric-label">Due Today</div>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon" style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', color: '#fff' }}>
            <Clock size={22} />
          </div>
          <div>
            <div className="metric-value">{metrics?.active_followups_count || 0}</div>
            <div className="metric-label">Waiting Follow-ups</div>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon" style={{ background: 'var(--emerald-gradient)', color: '#fff' }}>
            <Calendar size={22} />
          </div>
          <div>
            <div className="metric-value">{metrics?.today_meetings_count || 0}</div>
            <div className="metric-label">Meetings Today</div>
          </div>
        </div>

        <div className="metric-card" onClick={() => onNavigate('inbox')} style={{ cursor: 'pointer' }}>
          <div className="metric-icon" style={{ background: 'var(--cyan-gradient)', color: '#fff' }}>
            <InboxIcon size={22} />
          </div>
          <div>
            <div className="metric-value">{metrics?.raw_inbox_count || 0}</div>
            <div className="metric-label">Inbox Raw Captures</div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.8fr 1fr', gap: '1.75rem' }}>
        <div>
          {/* NEEDS ATTENTION BANNER */}
          <div className="card attention-card">
            <div className="card-title">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: 'var(--rose)' }}>
                <AlertTriangle size={20} />
                <span>Needs Immediate Attention</span>
              </div>
              <span className="badge badge-red">
                <span className="badge-dot" style={{ background: 'var(--rose)' }} />
                {attentionItems.length} Critical Items
              </span>
            </div>

            {attentionItems.length === 0 ? (
              <div style={{ padding: '1.25rem 0', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                🎉 Everything running smoothly. Zero overdue or flagged risk items!
              </div>
            ) : (
              <div>
                {attentionItems.map((item) => (
                  <div key={item.id} className="attention-item">
                    <div style={{ marginTop: '2px' }}>
                      {item.severity === 'critical' ? (
                        <span className="badge badge-red">
                          <span className="badge-dot" style={{ background: 'var(--rose)' }} />
                          Critical
                        </span>
                      ) : (
                        <span className="badge badge-amber">
                          <span className="badge-dot" style={{ background: 'var(--amber)' }} />
                          High
                        </span>
                      )}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.98rem' }}>
                        {item.title}
                      </div>
                      <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.15rem' }}>
                        {item.subtitle}
                      </div>
                    </div>
                    {item.related_entity_type === 'task' && (
                      <button
                        className="btn-secondary"
                        onClick={() => handleTaskDone(item.related_entity_id)}
                        style={{ fontSize: '0.82rem', padding: '0.4rem 0.85rem' }}
                      >
                        Mark Done
                      </button>
                    )}
                    {item.related_entity_type === 'followup' && (
                      <button
                        className="btn-secondary"
                        onClick={() => onNavigate('followups')}
                        style={{ fontSize: '0.82rem', padding: '0.4rem 0.85rem' }}
                      >
                        Follow Up
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ACTIVE PROJECTS HEALTH */}
          <div className="card">
            <div className="card-title">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <Layers size={20} color="var(--primary)" />
                <span>Active Projects & Operational Health</span>
              </div>
              <button
                style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.88rem', fontWeight: 600 }}
                onClick={() => onNavigate('projects')}
              >
                <span>View All Projects</span>
                <ArrowRight size={14} />
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginTop: '1rem' }}>
              <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-glass)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 500 }}>On Track (Green)</span>
                <span className="badge badge-green">
                  <span className="badge-dot" style={{ background: 'var(--emerald)' }} />
                  {metrics?.projects_summary.green || 0}
                </span>
              </div>
              <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-glass)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Attention (Amber)</span>
                <span className="badge badge-amber">
                  <span className="badge-dot" style={{ background: 'var(--amber)' }} />
                  {metrics?.projects_summary.amber || 0}
                </span>
              </div>
              <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-glass)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 500 }}>At Risk (Red)</span>
                <span className="badge badge-red">
                  <span className="badge-dot" style={{ background: 'var(--rose)' }} />
                  {metrics?.projects_summary.red || 0}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* SIDEBAR COLUMN */}
        <div>
          <div className="card">
            <div className="card-title">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <UserCheck size={20} color="var(--amber)" />
                <span>Waiting On Others</span>
              </div>
              <button
                style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600 }}
                onClick={() => onNavigate('followups')}
              >
                Manage
              </button>
            </div>

            <p style={{ fontSize: '0.83rem', color: 'var(--text-secondary)', marginBottom: '1.15rem' }}>
              Commitments where delivery is owed by team members or client reviewers.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ padding: '0.9rem 1rem', background: 'rgba(15, 23, 42, 0.6)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-glass)' }}>
                <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.92rem' }}>
                  Ravi — QC Review Validation
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.35rem', fontSize: '0.8rem' }}>
                  <span style={{ color: 'var(--amber)', fontWeight: 600 }}>Waiting 3 days</span>
                  <span style={{ color: 'var(--text-muted)' }}>Due: Wednesday</span>
                </div>
              </div>

              <div style={{ padding: '0.9rem 1rem', background: 'rgba(15, 23, 42, 0.6)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-glass)' }}>
                <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.92rem' }}>
                  David Vance — API Key Scope
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.35rem', fontSize: '0.8rem' }}>
                  <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Waiting 1 day</span>
                  <span style={{ color: 'var(--text-muted)' }}>Due: Friday</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
