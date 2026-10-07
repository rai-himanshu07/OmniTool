'use client';
import { useEffect, useState } from 'react';
import { Bell, Save, Plus, Trash2, KeyRound, CalendarDays, Clock } from 'lucide-react';
import { requestJson } from '@/lib/client';
import { authClient } from '@/lib/authClient';

export default function PreferencesView() {
  const [prefs, setPrefs] = useState<any>(null);
  const [items, setItems] = useState<{ type: string; id: string; title: string }[]>([]);
  const [reminders, setReminders] = useState<any[]>([]);
  const [item, setItem] = useState('');
  const [time, setTime] = useState('');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [role, setRole] = useState('');
  const [tab, setTab] = useState('alerts');
  const load = async () => {
    try {
      setPrefs(await requestJson('/api/preferences'));
      const account = await requestJson('/api/me'); setRole(account.role);
      const [tasks, followups, events, list] = await Promise.all([requestJson('/api/tasks'), requestJson('/api/followups'), requestJson('/api/calendar'), requestJson('/api/reminders')]);
      setItems([...(tasks.tasks || []).map((record: any) => ({ type: 'task', id: record.id, title: record.title })), ...(followups.followups || []).map((record: any) => ({ type: 'followup', id: record.id, title: record.title })), ...(events.events || []).map((record: any) => ({ type: 'meeting', id: record.id, title: record.title }))]);
      setReminders(list.reminders);
    } catch (error) { setStatus(String(error)); }
  };
  useEffect(() => { load(); }, []);
  const field = (key: string, value: any) => setPrefs({ ...prefs, [key]: value });
  if (!prefs) return <p role="status">{status || 'Loading preferences...'}</p>;
  return <div className="preferences-view configuration-page"><div className="page-header"><h1>My Preferences</h1></div>
    <div className="tabs configuration-tabs" role="tablist" aria-label="Personal preferences">{[{ value: 'alerts', label: 'Alerts', icon: Bell }, { value: 'working', label: 'Working Time', icon: CalendarDays }, ...(role !== 'viewer' ? [{ value: 'reminders', label: 'Reminders', icon: Clock }] : []), { value: 'account', label: 'Account', icon: KeyRound }].map(({ value, label, icon: Icon }) => <button type="button" role="tab" aria-selected={tab === value} className={`tab ${tab === value ? 'active' : ''}`} key={value} onClick={() => setTab(value)}><Icon size={16} /> {label}</button>)}</div>
    {status && <p role="status" className={status.startsWith('Error') ? 'work-error' : 'configuration-status'}>{status}</p>}
    <form hidden={!['alerts', 'working'].includes(tab)} onSubmit={async (event) => { event.preventDefault(); try { setPrefs(await requestJson('/api/preferences', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(prefs) })); setStatus('Preferences saved'); } catch (error) { setStatus(String(error)); } }}>
      <section className="configuration-section" hidden={tab !== 'alerts'}><h2>Notification Delivery</h2>
        <div className="choice-grid"><label><input type="checkbox" checked={prefs.desktop_alerts} onChange={(event) => field('desktop_alerts', event.target.checked)} /> Desktop alerts</label></div>
        <h3>Alert Categories</h3><div className="choice-grid">{[{ value: 'overdue', label: 'Overdue tasks' }, { value: 'due_soon', label: 'Due today' }, { value: 'followup_aging', label: 'Waiting follow-ups' }, { value: 'meeting_soon', label: 'Upcoming meetings' }, { value: 'reminder', label: 'Personal reminders' }, { value: 'recurring_due', label: 'Recurring work' }].map(({ value, label }) => <label key={value}><input type="checkbox" checked={prefs.enabled_types.includes(value)} onChange={(event) => field('enabled_types', event.target.checked ? [...prefs.enabled_types, value] : prefs.enabled_types.filter((entry: string) => entry !== value))} /> {label}</label>)}</div>
        <h3>Quiet Hours & Meeting Lead Time</h3><div className="configuration-grid"><label>Quiet hours from<input className="form-input" type="time" value={prefs.quiet_start} onChange={(event) => field('quiet_start', event.target.value)} /></label><label>Quiet hours until<input className="form-input" type="time" value={prefs.quiet_end} onChange={(event) => field('quiet_end', event.target.value)} /></label><label>Meeting alert, minutes before<input className="form-input" type="number" min="0" max="1440" value={prefs.meeting_lead_minutes} onChange={(event) => field('meeting_lead_minutes', Number(event.target.value))} /></label></div>
      </section>
      <section className="configuration-section" hidden={tab !== 'working'}><h2>Working Day</h2><div className="configuration-grid"><label>Work starts<input className="form-input" type="time" value={prefs.work_start} onChange={(event) => field('work_start', event.target.value)} /></label><label>Work ends<input className="form-input" type="time" value={prefs.work_end} onChange={(event) => field('work_end', event.target.value)} /></label><label>Daily work budget, minutes<input className="form-input" type="number" min="0" max="1440" value={prefs.daily_minutes} onChange={(event) => field('daily_minutes', Number(event.target.value))} /></label><label>Timezone<input className="form-input" value={prefs.timezone} onChange={(event) => field('timezone', event.target.value)} list="timezones" /><datalist id="timezones"><option>{Intl.DateTimeFormat().resolvedOptions().timeZone}</option><option>UTC</option></datalist></label></div><h3>Days Off</h3><div className="day-choices">{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, index) => <label key={day}><input type="checkbox" checked={prefs.weekend_days.includes(index)} onChange={(event) => field('weekend_days', event.target.checked ? [...prefs.weekend_days, index] : prefs.weekend_days.filter((value: number) => value !== index))} /> {day}</label>)}</div></section>
      <div className="configuration-footer"><button className="btn-capture"><Save size={16} /> Save preferences</button></div>
    </form>
    {role !== 'viewer' && <section className="configuration-section" hidden={tab !== 'reminders'}><h2>Personal Reminders</h2><form onSubmit={async (event) => { event.preventDefault(); const target = items.find((record) => `${record.type}:${record.id}` === item); if (!target) return; try { await requestJson('/api/reminders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ entity_type: target.type, entity_id: target.id, remind_at: new Date(time).toISOString(), message: message || target.title }) }); setStatus('Reminder saved'); setMessage(''); load(); } catch (error) { setStatus(String(error)); } }}><div className="configuration-grid"><label>Work item<select className="form-select" required value={item} onChange={(event) => setItem(event.target.value)}><option value="">Select item</option>{items.map((record) => <option key={`${record.type}:${record.id}`} value={`${record.type}:${record.id}`}>{record.type}: {record.title}</option>)}</select></label><label>Reminder time<input className="form-input" type="datetime-local" required value={time} onChange={(event) => setTime(event.target.value)} /></label><label>Message<input className="form-input" value={message} onChange={(event) => setMessage(event.target.value)} /></label></div><div className="configuration-footer"><button className="btn-capture"><Plus size={16} /> Add reminder</button></div></form>
      {reminders.map((record) => <div className="recovery-row" key={record.id}><span>{record.message} · {new Date(record.remind_at).toLocaleString()} {record.is_fired ? '(fired)' : ''}</span><button className="notification-trigger" title="Delete reminder" onClick={async () => { try { await requestJson(`/api/reminders?id=${record.id}`, { method: 'DELETE' }); load(); } catch (error) { setStatus(String(error)); } }}><Trash2 size={16} /></button></div>)}
    </section>}
    <section className="configuration-section" hidden={tab !== 'account'}><h2>Account Password</h2><form onSubmit={async (event) => { event.preventDefault(); if (newPassword !== passwordConfirm) { setStatus('Passwords do not match'); return; } try { const result = await authClient.changePassword({ currentPassword: password, newPassword, revokeOtherSessions: true }); if (result.error) throw new Error(result.error.message); setPassword(''); setNewPassword(''); setPasswordConfirm(''); setStatus('Password changed. Other sessions were signed out.'); } catch (error) { setStatus(String(error)); } }}><div className="configuration-grid"><label>Current password<input className="form-input" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} /></label><label>New password<input className="form-input" type="password" minLength={12} autoComplete="new-password" required value={newPassword} onChange={(event) => setNewPassword(event.target.value)} /></label><label>Confirm new password<input className="form-input" type="password" required value={passwordConfirm} onChange={(event) => setPasswordConfirm(event.target.value)} /></label></div><div className="configuration-footer"><button className="btn-capture"><KeyRound size={16} /> Change password</button></div></form></section>
  </div>;
}