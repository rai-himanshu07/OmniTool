'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Calendar as CalendarIcon, MapPin, ExternalLink, Plus, RefreshCw, Link2Off, Pencil, Trash2 } from 'lucide-react';
import { CalendarEvent, Project } from '@/lib/db/schema';
import MeetingOutcomeForm from '@/components/MeetingOutcomeForm';
import { requestJson, useUnsavedChanges } from '@/lib/client';

const STALE_SYNC_MS = 15 * 60 * 1000; // auto-sync if last synced more than 15 minutes ago
const syncIsStale = (lastSyncedAt: string | null) => !lastSyncedAt || Date.now() - new Date(lastSyncedAt).getTime() > STALE_SYNC_MS;
const localDateTime = (value: string) => {
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

export default function CalendarView() {
  const router = useRouter();
  const [events, setEvents] = useState<(CalendarEvent & { provider?: string })[]>([]);
  const [role, setRole] = useState('');
  const [projects, setProjects] = useState<Project[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [location, setLocation] = useState('');
  const [projectId, setProjectId] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [calConnected, setCalConnected] = useState(false);
  const [googleConnected, setGoogleConnected] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [googleSyncedAt, setGoogleSyncedAt] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [outcomeEvent, setOutcomeEvent] = useState<CalendarEvent | null>(null);
  useUnsavedChanges(showForm && (!!title || !!startTime || !!endTime));
  const autoSyncTriggered = useRef(new Set<string>());
  const [view, setView] = useState('upcoming');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 60000); return () => clearInterval(timer); }, []);
  const visibleEvents = events.filter((event) => view === 'upcoming' ? Date.parse(event.end_time) >= now
    : view === 'past' ? Date.parse(event.end_time) < now
    : (!fromDate || Date.parse(event.end_time) >= new Date(`${fromDate}T00:00:00`).getTime()) && (!toDate || Date.parse(event.start_time) <= new Date(`${toDate}T23:59:59`).getTime()));
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('focus');
    const event = events.find((item) => item.id === id);
    if (!event) return;
    setView(Date.parse(event.end_time) < Date.now() ? 'past' : 'upcoming');
    const frame = requestAnimationFrame(() => document.getElementById(`meeting-${id}`)?.scrollIntoView({ block: 'center' }));
    return () => cancelAnimationFrame(frame);
  }, [events]);

  const fetchEvents = () => {
    fetch('/api/calendar?view=all')
      .then((res) => res.json())
      .then((d) => {
        setEvents(d.events || []);
        const microsoft = d.sources?.find((source: { provider: string }) => source.provider === 'microsoft');
        const google = d.sources?.find((source: { provider: string }) => source.provider === 'google');
        setCalConnected(!!microsoft?.connected);
        setLastSyncedAt(microsoft?.last_synced_at || null);
        setGoogleConnected(!!google?.connected);
        setGoogleSyncedAt(google?.last_synced_at || null);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  const checkCalendarConfig = async () => {
    try {
      const [microsoft, google] = await Promise.all([
        fetch('/api/calendar/msgraph/config').then((response) => response.json()),
        fetch('/api/calendar/google/config').then((response) => response.json()),
      ]);
      setCalConnected(!!microsoft.connected);
      setLastSyncedAt(microsoft.last_synced_at || null);
      setGoogleConnected(!!google.connected);
      setGoogleSyncedAt(google.last_synced_at || null);
      const stale = [
        { name: 'microsoft', config: microsoft, url: '/api/calendar/msgraph/sync' },
        { name: 'google', config: google, url: '/api/calendar/google/sync' },
      ].filter(({ name, config }) => config.connected && syncIsStale(config.last_synced_at) && !autoSyncTriggered.current.has(name));
      for (const source of stale) autoSyncTriggered.current.add(source.name);
      if (stale.length) {
        await Promise.allSettled(stale.map(({ url }) => fetch(url, { method: 'POST' })));
        fetchEvents();
        const [ms, gs] = await Promise.all([fetch('/api/calendar/msgraph/config').then((r) => r.json()), fetch('/api/calendar/google/config').then((r) => r.json())]);
        setLastSyncedAt(ms.last_synced_at || null);
        setGoogleSyncedAt(gs.last_synced_at || null);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchEvents();
    fetch('/api/me').then((response) => response.json()).then((account) => {
      setRole(account.role || '');
      if (account.role === 'admin') checkCalendarConfig();
    }).catch(console.error);
    fetch('/api/projects').then((res) => res.json()).then((data) => setProjects(data.projects || [])).catch(console.error);
  }, []);

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setTitle('');
    setStartTime('');
    setEndTime('');
    setLocation('');
    setProjectId('');
    setError('');
  };

  const editEvent = (event: CalendarEvent) => {
    setEditingId(event.id);
    setTitle(event.title);
    setStartTime(localDateTime(event.start_time));
    setEndTime(localDateTime(event.end_time));
    setLocation(event.location || '');
    setProjectId(event.related_project_id || '');
    setShowForm(true);
    setError('');
  };

  const saveEvent = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    try {
      const response = await fetch('/api/calendar', {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...(editingId ? { id: editingId } : {}), title: title.trim(),
          start_time: new Date(startTime).toISOString(), end_time: new Date(endTime).toISOString(),
          location, related_project_id: projectId || null }),
      });
      if (!response.ok) throw new Error((await response.json()).error || 'Could not save event');
      closeForm();
      fetchEvents();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save event');
    }
  };

  const deleteEvent = async (id: string) => {
    if (!confirm('Move this local event to Trash?')) return;
    try { await requestJson(`/api/calendar?id=${encodeURIComponent(id)}`, { method: 'DELETE' }); fetchEvents(); }
    catch (cause) { setError(String(cause)); }
  };

  const handleSyncNow = async () => {
    setSyncing(true);
    try {
      const urls = [calConnected && '/api/calendar/msgraph/sync', googleConnected && '/api/calendar/google/sync'].filter(Boolean) as string[];
      const results = await Promise.allSettled(urls.map(async (url) => {
        const response = await fetch(url, { method: 'POST' });
        if (!response.ok) throw new Error((await response.json()).error || 'Calendar sync failed');
      }));
      const failed = results.find((result) => result.status === 'rejected');
      setError(failed?.status === 'rejected' ? failed.reason.message : '');
      fetchEvents();
      await checkCalendarConfig();
    } catch (err) {
      console.error(err);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-primary)' }}>Calendar & Schedule</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            {calConnected || googleConnected ? 'Local agenda with connected calendar overlays' : 'Local agenda — connect a calendar in Settings for an overlay'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {role !== 'viewer' && role && <button className="btn-capture" onClick={() => { closeForm(); setShowForm(true); }}><Plus size={16} /> New event</button>}
        {role === 'admin' && (calConnected || googleConnected) ? (
          <button className="btn-secondary" onClick={handleSyncNow} disabled={syncing} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <RefreshCw size={14} /> {syncing ? 'Syncing…' : 'Sync now'}
          </button>
        ) : role === 'admin' ? (
          <button className="btn-secondary" onClick={() => router.push('/settings')} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <Link2Off size={14} /> Connect calendar
          </button>
        ) : null}
        </div>
      </div>

      {showForm && (
        <form className="inline-form" onSubmit={saveEvent} style={{ marginBottom: '1rem' }}>
          <h2 style={{ fontSize: '1rem', marginBottom: '0.75rem' }}>{editingId ? 'Edit local event' : 'New local event'}</h2>
          <div className="form-row">
            <div className="form-group"><label className="form-label">Title</label><input className="form-input" value={title} onChange={(e) => setTitle(e.target.value)} required /></div>
            <div className="form-group"><label className="form-label">Start</label><input type="datetime-local" className="form-input" value={startTime} onChange={(e) => setStartTime(e.target.value)} required /></div>
            <div className="form-group"><label className="form-label">End</label><input type="datetime-local" className="form-input" value={endTime} onChange={(e) => setEndTime(e.target.value)} required /></div>
            <div className="form-group"><label className="form-label">Location</label><input className="form-input" value={location} onChange={(e) => setLocation(e.target.value)} /></div>
            <div className="form-group"><label className="form-label">Project</label><select className="form-select" value={projectId} onChange={(e) => setProjectId(e.target.value)}><option value="">None</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></div>
          </div>
          {error && <p role="alert" style={{ color: 'var(--danger)' }}>{error}</p>}
          <div className="form-actions"><button type="button" className="btn-secondary" onClick={closeForm}>Cancel</button><button type="submit" className="btn-capture">Save event</button></div>
        </form>
      )}
      {!showForm && error && <p role="alert" style={{ color: 'var(--danger)' }}>{error}</p>}
      {outcomeEvent && <MeetingOutcomeForm event={outcomeEvent} onClose={() => setOutcomeEvent(null)} />}
      {(calConnected && syncIsStale(lastSyncedAt) || googleConnected && syncIsStale(googleSyncedAt)) && <p role="status" className="work-error">Calendar cache is stale. Check connection or sync again.</p>}
      <div className="tabs">{['upcoming', 'past', 'range'].map((mode) => <button key={mode} className={`tab ${view === mode ? 'active' : ''}`} onClick={() => setView(mode)}>{mode === 'range' ? 'Date range' : mode === 'past' ? 'Past' : 'Upcoming'}</button>)}</div>
      {view === 'range' && <div className="form-row"><label>From<input className="form-input" type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} /></label><label>Through<input className="form-input" type="date" value={toDate} min={fromDate} onChange={(event) => setToDate(event.target.value)} /></label></div>}

      {loading ? (
        <div style={{ color: 'var(--text-muted)' }}>Loading agenda events...</div>
      ) : (
        <div className="card">
          <div className="card-title">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <CalendarIcon size={20} color="var(--emerald)" />
              <span>{view === 'past' ? 'Past meetings' : view === 'range' ? 'Agenda' : 'Upcoming Agenda'}</span>
            </div>
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
              {calConnected && <span className="badge badge-green">M365 {lastSyncedAt ? new Date(lastSyncedAt).toLocaleTimeString() : 'Connected'}</span>}
              {googleConnected && <span className="badge badge-green">Google {googleSyncedAt ? new Date(googleSyncedAt).toLocaleTimeString() : 'Connected'}</span>}
              {!calConnected && !googleConnected && <span className="badge">Local only</span>}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {visibleEvents.map((evt) => {
              const startDate = new Date(evt.start_time);
              const endDate = new Date(evt.end_time);

              return (
                <div id={`meeting-${evt.id}`} key={evt.id} style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '1.25rem', padding: '1rem', background: 'var(--bg-card)', borderRadius: 'var(--radius-md)' }}>
                  <div style={{ textAlign: 'center', paddingRight: '1rem', borderRight: '1px solid var(--border-subtle)', minWidth: '80px' }}>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                      {startDate.toLocaleDateString('en-US', { weekday: 'short', ...(evt.is_all_day ? { timeZone: 'UTC' } : {}) })}
                    </div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--emerald)' }}>
                      {evt.is_all_day ? startDate.getUTCDate() : startDate.getDate()}
                    </div>
                  </div>

                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '1rem' }}>{evt.title} {evt.provider && <span className="badge">{evt.provider === 'google' ? 'Google' : 'M365'}</span>}</div>
                    {events.some((other) => other.id !== evt.id && !other.is_all_day && !evt.is_all_day && Date.parse(other.start_time) < Date.parse(evt.end_time) && Date.parse(other.end_time) > Date.parse(evt.start_time)) && <span className="badge badge-amber">Overlap</span>}
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>
                      {evt.is_all_day ? 'All day' : `${startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${endDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                    </div>
                  </div>

                  {evt.location && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      <MapPin size={14} />
                      <span>{evt.location}</span>
                    </div>
                  )}

                  {evt.external_link && (
                    <a href={evt.external_link} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-muted)' }}>
                      <ExternalLink size={14} />
                    </a>
                  )}
                  {role !== 'viewer' && !!role && !evt.source_id && !evt.calendar_source_id && (
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button type="button" className="btn-secondary" onClick={() => editEvent(evt)} aria-label={`Edit ${evt.title}`}><Pencil size={14} /></button>
                      <button type="button" className="btn-secondary" onClick={() => deleteEvent(evt.id)} aria-label={`Delete ${evt.title}`}><Trash2 size={14} /></button>
                    </div>
                  )}
                  {role && role !== 'viewer' && <button className="btn-secondary" onClick={() => setOutcomeEvent(evt)}><Plus size={14} /> Outcome</button>}
                </div>
              );
            })}
            {visibleEvents.length === 0 && <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No events in this view.</div>}
          </div>
        </div>
      )}
    </div>
  );
}
