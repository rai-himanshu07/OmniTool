'use client';

import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Settings, Download, Database, Shield, Monitor, CalendarDays, CheckCircle2, AlertTriangle, RefreshCw, Unlink, LockKeyhole, UsersRound, Copy } from 'lucide-react';
import RecoveryPanel from '@/components/RecoveryPanel';

interface CalendarConfig {
  configured: boolean;
  connected: boolean;
  tenant_id: string | null;
  client_id: string | null;
  account_email: string | null;
  last_synced_at: string | null;
  last_sync_error: string | null;
  app_base_url: string;
}

interface GoogleConfig {
  configured: boolean;
  connected: boolean;
  client_id: string | null;
  last_synced_at: string | null;
  last_sync_error: string | null;
  app_base_url: string;
}

interface AiConfig {
  configured: boolean;
  base_url: string;
  model: string;
  has_key: boolean;
}

type Account = { id: string; name: string; email: string; role: string; person_id: string | null; person_name: string | null };
type Invitation = { id: string; email: string; role: string; expires_at: string; accepted_at: string | null };
type PersonOption = { id: string; name: string; active: number };

export default function SettingsView() {
  const searchParams = useSearchParams();
  const [section, setSection] = useState(searchParams?.get('google_calendar') || searchParams?.get('calendar') || searchParams?.get('google_error') || searchParams?.get('calendar_error') ? 'integrations' : 'access');
  const [calConfig, setCalConfig] = useState<CalendarConfig | null>(null);
  const [googleConfig, setGoogleConfig] = useState<GoogleConfig | null>(null);
  const [googleClientId, setGoogleClientId] = useState('');
  const [googleClientSecret, setGoogleClientSecret] = useState('');
  const [editingGoogle, setEditingGoogle] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [googleStatus, setGoogleStatus] = useState('');
  const [vaultInitialized, setVaultInitialized] = useState<boolean | null>(null);
  const [vaultIterations, setVaultIterations] = useState<number | null>(null);

  const [tenantId, setTenantId] = useState('');
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [appBaseUrl, setAppBaseUrl] = useState('');
  const [editingCalendar, setEditingCalendar] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [savingCalendar, setSavingCalendar] = useState(false);
  const [aiConfig, setAiConfig] = useState<AiConfig | null>(null);
  const [aiBaseUrl, setAiBaseUrl] = useState('https://api.openai.com/v1');
  const [aiModel, setAiModel] = useState('');
  const [aiKey, setAiKey] = useState('');
  const [aiStatus, setAiStatus] = useState('');
  const [aiBusy, setAiBusy] = useState(false);
  const [pinEnabled, setPinEnabled] = useState(false);
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinStatus, setPinStatus] = useState('');
  const [idleMinutes, setIdleMinutes] = useState('15');
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [people, setPeople] = useState<PersonOption[]>([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('member');
  const [invitePersonId, setInvitePersonId] = useState('');
  const [invitationUrl, setInvitationUrl] = useState('');
  const [accessStatus, setAccessStatus] = useState('');

  const bannerConnected = searchParams?.get('calendar') === 'connected';
  const bannerError = searchParams?.get('calendar_error');

  const loadCalendarConfig = () => {
    fetch('/api/calendar/msgraph/config')
      .then((r) => r.json())
      .then((d) => {
        setCalConfig(d);
        setAppBaseUrl(d.app_base_url || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'));
      })
      .catch(console.error);
  };

  const loadGoogleConfig = () => {
    fetch('/api/calendar/google/config').then((response) => response.json())
      .then((config: GoogleConfig) => setGoogleConfig(config)).catch(console.error);
  };

  const loadAccounts = async () => {
    try {
      const [accountsResponse, invitationsResponse, peopleResponse] = await Promise.all([fetch('/api/accounts'), fetch('/api/invitations'), fetch('/api/people')]);
      if (!accountsResponse.ok || !invitationsResponse.ok || !peopleResponse.ok) throw new Error('Could not load accounts');
      setAccounts((await accountsResponse.json()).accounts || []);
      setInvitations((await invitationsResponse.json()).invitations || []);
      setPeople((await peopleResponse.json()).people || []);
    } catch { setAccessStatus('Could not load access settings.'); }
  };

  useEffect(() => {
    loadCalendarConfig();
    loadGoogleConfig();
    loadAccounts();
    setIdleMinutes(localStorage.getItem('omnitool:idle-minutes') || '15');
    fetch('/api/screen-lock').then((response) => response.json()).then((data) => setPinEnabled(!!data.enabled)).catch(console.error);
    fetch('/api/ai/config').then((response) => response.json()).then((config: AiConfig) => {
      setAiConfig(config);
      if (config.base_url) setAiBaseUrl(config.base_url);
      setAiModel(config.model);
    }).catch(console.error);
    fetch('/api/vault/meta')
      .then((r) => r.json())
      .then((d) => {
        setVaultInitialized(!!(d.meta && d.meta.is_initialized));
        setVaultIterations(d.meta?.kdf_iterations || null);
      })
      .catch(console.error);
  }, []);

  const handleExportBackup = () => {
    window.open('/api/export', '_blank');
  };

  const redirectUri = `${(appBaseUrl || '').replace(/\/$/, '')}/api/calendar/msgraph/callback`;
  const googleRedirectUri = `${(appBaseUrl || '').replace(/\/$/, '')}/api/calendar/google/callback`;

  const saveGoogle = async (event: React.FormEvent) => {
    event.preventDefault();
    setGoogleBusy(true);
    setGoogleStatus('');
    try {
      const response = await fetch('/api/calendar/google/config', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: googleClientId.trim(), client_secret: googleClientSecret.trim(), app_base_url: appBaseUrl.trim() }) });
      if (!response.ok) throw new Error((await response.json()).error || 'Could not save Google credentials');
      window.location.assign(new URL('/api/calendar/google/login', window.location.origin).toString());
    } catch (error) {
      setGoogleStatus(error instanceof Error ? error.message : 'Could not save Google credentials');
      setGoogleBusy(false);
    }
  };

  const syncGoogle = async () => {
    setGoogleBusy(true);
    try {
      const response = await fetch('/api/calendar/google/sync', { method: 'POST' });
      if (!response.ok) throw new Error((await response.json()).error || 'Google sync failed');
      setGoogleStatus('Google Calendar synced.');
    } catch (error) { setGoogleStatus(error instanceof Error ? error.message : 'Google sync failed'); }
    finally { loadGoogleConfig(); setGoogleBusy(false); }
  };

  const removeGoogle = async () => {
    if (!confirm('Disconnect Google Calendar? Cached Google events will be removed.')) return;
    const response = await fetch('/api/calendar/google/config', { method: 'DELETE' });
    if (!response.ok) { setGoogleStatus('Could not disconnect Google Calendar.'); return; }
    setEditingGoogle(false);
    setGoogleStatus('Google Calendar disconnected.');
    loadGoogleConfig();
  };

  const handleSaveCalendarConfig = async () => {
    if (!tenantId.trim() || !clientId.trim() || !clientSecret.trim()) return;
    setSavingCalendar(true);
    try {
      await fetch('/api/calendar/msgraph/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: tenantId.trim(),
          client_id: clientId.trim(),
          client_secret: clientSecret.trim(),
          app_base_url: appBaseUrl.trim(),
        }),
      });
      window.location.assign(new URL('/api/calendar/msgraph/login', window.location.origin).toString());
    } catch (err) {
      console.error(err);
      setSavingCalendar(false);
    }
  };

  const handleSyncNow = async () => {
    setSyncing(true);
    try {
      await fetch('/api/calendar/msgraph/sync', { method: 'POST' });
      loadCalendarConfig();
    } catch (err) {
      console.error(err);
    } finally {
      setSyncing(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Disconnect Microsoft 365 calendar? Synced events will be removed from your local cache.')) return;
    await fetch('/api/calendar/msgraph/config', { method: 'DELETE' });
    loadCalendarConfig();
  };

  const saveAiConfig = async (event: React.FormEvent) => {
    event.preventDefault();
    setAiBusy(true);
    setAiStatus('');
    try {
      const response = await fetch('/api/ai/config', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base_url: aiBaseUrl.trim(), model: aiModel.trim(), api_key: aiKey }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not save provider');
      setAiConfig(data);
      setAiKey('');
      setAiStatus('Provider saved. AI suggestions are available in Inbox and Week Review.');
    } catch (error) {
      setAiStatus(error instanceof Error ? error.message : 'Could not save provider');
    } finally { setAiBusy(false); }
  };

  const testAiConfig = async () => {
    setAiBusy(true);
    try {
      const response = await fetch('/api/ai/config', { method: 'PUT' });
      const data = await response.json();
      setAiStatus(response.ok ? 'Provider connection succeeded.' : data.error || 'Connection failed');
    } catch { setAiStatus('Connection failed'); }
    finally { setAiBusy(false); }
  };

  const removeAiConfig = async () => {
    if (!confirm('Remove the saved AI provider and credential?')) return;
    const response = await fetch('/api/ai/config', { method: 'DELETE' });
    if (response.ok) { setAiConfig(null); setAiKey(''); setAiStatus('Provider removed.'); }
  };

  const savePin = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!/^\d{4}$/.test(newPin) || newPin !== confirmPin) { setPinStatus('PINs must match and contain four digits.'); return; }
    try {
      const response = await fetch('/api/screen-lock', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pin: newPin, current_pin: currentPin }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not save PIN');
      setPinEnabled(true); setCurrentPin(''); setNewPin(''); setConfirmPin(''); setPinStatus('Screen lock enabled.');
      window.dispatchEvent(new Event('omnitool:lock-config-changed'));
    } catch (cause) { setPinStatus(cause instanceof Error ? cause.message : 'Could not save PIN'); }
  };

  const disablePin = async () => {
    const response = await fetch('/api/screen-lock', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ current_pin: currentPin }) });
    const data = await response.json();
    if (!response.ok) { setPinStatus(data.error || 'Could not disable lock'); return; }
    setPinEnabled(false); setCurrentPin(''); setNewPin(''); setConfirmPin(''); setPinStatus('Screen lock disabled.');
    window.dispatchEvent(new Event('omnitool:lock-config-changed'));
  };

  const createInvitation = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      const response = await fetch('/api/invitations', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole, person_id: invitePersonId || null }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not create invitation');
      setInvitationUrl(data.invitation_url); setInviteEmail(''); setInvitePersonId(''); setAccessStatus('Invitation ready. Share its link privately.');
      loadAccounts();
    } catch (cause) { setAccessStatus(cause instanceof Error ? cause.message : 'Could not create invitation'); }
  };

  const updateAccount = async (account: Account, role: string, personId = account.person_id) => {
    const response = await fetch('/api/accounts', { method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: account.id, role, person_id: personId }) });
    if (!response.ok) { setAccessStatus((await response.json()).error || 'Could not update account'); return; }
    setAccessStatus('Access updated.'); loadAccounts();
  };

  const revokeInvitation = async (id: string) => {
    const response = await fetch(`/api/invitations?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (!response.ok) { setAccessStatus('Could not revoke invitation.'); return; }
    loadAccounts();
  };

  return (
    <div className="configuration-page">
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-primary)' }}>Settings</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          Workspace configuration and data export
        </p>
      </div>

      {bannerConnected && (
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', borderColor: 'rgba(52, 211, 153, 0.4)', marginBottom: '1.5rem' }}>
          <CheckCircle2 size={18} color="var(--success)" />
          <span style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>Microsoft 365 calendar connected and synced.</span>
        </div>
      )}
      {bannerError && (
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', borderColor: 'rgba(255, 69, 58, 0.4)', marginBottom: '1.5rem' }}>
          <AlertTriangle size={18} color="var(--danger)" />
          <span style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>{bannerError}</span>
        </div>
      )}
      {searchParams?.get('google_calendar') === 'connected' && <p role="status" className="card" style={{ marginBottom: '1rem' }}>Google Calendar connected.</p>}
      {searchParams?.get('google_error') && <p role="alert" className="card" style={{ marginBottom: '1rem', color: 'var(--danger)' }}>{searchParams.get('google_error')}</p>}

      <div className="tabs configuration-tabs" role="tablist" aria-label="Workspace settings">{[{ value: 'access', label: 'Workspace Access', icon: UsersRound }, { value: 'security', label: 'Security', icon: Shield }, { value: 'integrations', label: 'Integrations', icon: CalendarDays }, { value: 'data', label: 'Data & Recovery', icon: Download }, { value: 'system', label: 'System', icon: Database }].map(({ value, label, icon: Icon }) => <button className={`tab ${section === value ? 'active' : ''}`} role="tab" aria-selected={section === value} key={value} onClick={() => setSection(value)}><Icon size={16} /> {label}</button>)}</div>
      <div className="configuration-content">
        <section className="configuration-section" hidden={section !== 'access'}>
          <div className="card-title"><span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><UsersRound size={18} /> Workspace access</span></div>
          <div className="entity-list">{accounts.map((account) => <div className="work-row" key={account.id}>
            <div className="work-row-content"><strong>{account.name}</strong><small>{account.email}</small></div>
            <select className="form-select" style={{ width: 'auto' }} aria-label={`Role for ${account.name}`} value={account.role} onChange={(event) => updateAccount(account, event.target.value)}><option value="admin">Admin</option><option value="member">Member</option><option value="viewer">Viewer</option></select>
            <select className="form-select" style={{ width: 'auto' }} aria-label={`Directory person for ${account.name}`} value={account.person_id || ''} onChange={(event) => updateAccount(account, account.role, event.target.value || null)}><option value="">No linked person</option>{people.filter((person) => person.active || person.id === account.person_id).map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select>
          </div>)}</div>
          <form onSubmit={createInvitation} style={{ marginTop: '1rem' }}>
            <div className="form-row"><div className="form-group"><label className="form-label" htmlFor="invite-email">Invite email</label><input id="invite-email" className="form-input" type="email" required value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} /></div>
              <div className="form-group"><label className="form-label" htmlFor="invite-role">Role</label><select id="invite-role" className="form-select" value={inviteRole} onChange={(event) => setInviteRole(event.target.value)}><option value="member">Member</option><option value="viewer">Viewer</option><option value="admin">Admin</option></select></div>
              <div className="form-group"><label className="form-label" htmlFor="invite-person">Directory person</label><select id="invite-person" className="form-select" value={invitePersonId} onChange={(event) => setInvitePersonId(event.target.value)}><option value="">None</option>{people.filter((person) => person.active).map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select></div>
            </div><div className="form-actions"><button className="btn-capture" type="submit">Create invitation</button></div>
          </form>
          {invitationUrl && <div className="form-row" style={{ marginTop: '0.75rem' }}><input className="form-input" readOnly aria-label="One-time invitation link" value={invitationUrl} /><button className="btn-secondary" type="button" title="Copy invitation link" aria-label="Copy invitation link" onClick={() => navigator.clipboard.writeText(invitationUrl).then(() => setAccessStatus('Invitation link copied.')).catch(() => setAccessStatus('Could not copy invitation link.'))}><Copy size={16} /></button></div>}
          {invitations.filter((invitation) => !invitation.accepted_at && invitation.expires_at > new Date().toISOString()).map((invitation) => <div className="work-row" key={invitation.id}><span className="work-row-content"><strong>{invitation.email}</strong><small>{invitation.role} · expires {new Date(invitation.expires_at).toLocaleString()}</small></span><button type="button" className="btn-secondary" onClick={() => revokeInvitation(invitation.id)}>Revoke</button></div>)}
          {accessStatus && <p role="status" className="work-error">{accessStatus}</p>}
        </section>
        <section className="configuration-section" hidden={section !== 'security'} id="screen-lock">
          <div className="card-title"><span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><LockKeyhole size={18} /> Screen Lock</span><span className="badge">{pinEnabled ? 'On' : 'Off'}</span></div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1rem' }}>Convenience lock for this browser. It does not restrict API access or encrypt workspace data.</p>
          <form onSubmit={savePin}>
            <div className="form-row">
              {pinEnabled && <div className="form-group"><label className="form-label" htmlFor="lock-current-pin">Current PIN</label><input id="lock-current-pin" className="form-input" type="password" inputMode="numeric" maxLength={4} value={currentPin} onChange={(event) => setCurrentPin(event.target.value.replace(/\D/g, '').slice(0, 4))} autoComplete="off" /></div>}
              <div className="form-group"><label className="form-label" htmlFor="lock-new-pin">{pinEnabled ? 'New PIN' : 'Set PIN'}</label><input id="lock-new-pin" className="form-input" type="password" inputMode="numeric" maxLength={4} pattern="[0-9]{4}" value={newPin} onChange={(event) => setNewPin(event.target.value.replace(/\D/g, '').slice(0, 4))} autoComplete="new-password" required /></div>
              <div className="form-group"><label className="form-label" htmlFor="lock-confirm-pin">Confirm PIN</label><input id="lock-confirm-pin" className="form-input" type="password" inputMode="numeric" maxLength={4} pattern="[0-9]{4}" value={confirmPin} onChange={(event) => setConfirmPin(event.target.value.replace(/\D/g, '').slice(0, 4))} autoComplete="new-password" required /></div>
              <div className="form-group"><label className="form-label" htmlFor="lock-idle">Lock after inactivity</label><select id="lock-idle" className="form-select" value={idleMinutes} onChange={(event) => { setIdleMinutes(event.target.value); localStorage.setItem('omnitool:idle-minutes', event.target.value); window.dispatchEvent(new Event('omnitool:idle-setting-changed')); }}><option value="5">5 minutes</option><option value="15">15 minutes</option><option value="30">30 minutes</option><option value="0">Only manually</option></select></div>
            </div>
            {pinStatus && <p role="status" className="work-error">{pinStatus}</p>}
            <div className="form-actions">
              {pinEnabled && <button type="button" className="btn-secondary" onClick={() => window.dispatchEvent(new Event('omnitool:lock'))}>Lock now</button>}
              {pinEnabled && <button type="button" className="btn-secondary" onClick={disablePin} disabled={currentPin.length !== 4}>Disable</button>}
              <button type="submit" className="btn-capture" disabled={pinEnabled && currentPin.length !== 4}>{pinEnabled ? 'Change PIN' : 'Enable lock'}</button>
            </div>
          </form>
        </section>
        <section className="configuration-section" hidden={section !== 'integrations'}>
          <div className="card-title">AI provider <span className="badge">Optional</span></div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1rem' }}>
            Configure an OpenAI-compatible API or local model for optional Inbox and Week Review drafts. Data is sent only when you request a suggestion; saving remains manual.
          </p>
          <form onSubmit={saveAiConfig}>
            <div className="form-row">
              <div className="form-group"><label className="form-label" htmlFor="ai-url">API base URL</label><input id="ai-url" className="form-input" type="url" value={aiBaseUrl} onChange={(event) => setAiBaseUrl(event.target.value)} required /></div>
              <div className="form-group"><label className="form-label" htmlFor="ai-model">Model ID</label><input id="ai-model" className="form-input" value={aiModel} onChange={(event) => setAiModel(event.target.value)} required placeholder="Model identifier" /></div>
              <div className="form-group"><label className="form-label" htmlFor="ai-key">API key {aiConfig?.has_key && '(leave blank to retain)'}</label><input id="ai-key" className="form-input" type="password" value={aiKey} onChange={(event) => setAiKey(event.target.value)} autoComplete="new-password" placeholder="Optional for local models" /></div>
            </div>
            <div className="form-actions">
              {aiConfig?.configured && <button type="button" className="btn-secondary" onClick={removeAiConfig}>Remove</button>}
              {aiConfig?.configured && <button type="button" className="btn-secondary" disabled={aiBusy} onClick={testAiConfig}>Test connection</button>}
              <button type="submit" className="btn-capture" disabled={aiBusy}>{aiBusy ? 'Working...' : 'Save provider'}</button>
            </div>
            {aiStatus && <p role="status" style={{ marginTop: '0.75rem', color: 'var(--text-secondary)' }}>{aiStatus}</p>}
          </form>
        </section>
        <div className="configuration-section" hidden={section !== 'data'}>
          <div className="card-title">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Download size={20} color="var(--primary)" />
              <span>Data Export & Portability</span>
            </div>
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
            JSON snapshots contain structured records. Full recovery backups preserve accounts, encrypted data, and server credentials.
          </p>
          <button className="btn-capture" onClick={handleExportBackup}>
            <Download size={16} />
            <span>Export JSON Snapshot</span>
          </button>
        </div>

        <div hidden={section !== 'data'}><RecoveryPanel /></div>
        <div className="configuration-section" hidden={section !== 'integrations'}>
          <div className="card-title">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <CalendarDays size={20} color="var(--emerald)" />
              <span>Microsoft 365 Calendar</span>
            </div>
            {calConfig?.connected && <span className="badge badge-green">Connected</span>}
            {calConfig?.configured && !calConfig?.connected && <span className="badge badge-amber">Not connected</span>}
            {!calConfig?.configured && <span className="badge">Optional — not set up</span>}
          </div>

          {calConfig?.connected ? (
            <div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '1rem' }}>
                <div><b style={{ color: 'var(--text-primary)' }}>Account:</b> {calConfig.account_email || 'Unknown'}</div>
                <div><b style={{ color: 'var(--text-primary)' }}>Last synced:</b> {calConfig.last_synced_at ? new Date(calConfig.last_synced_at).toLocaleString() : 'Never'}</div>
                {calConfig.last_sync_error && <div style={{ color: 'var(--danger)' }}><b>Last error:</b> {calConfig.last_sync_error}</div>}
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="btn-secondary" onClick={handleSyncNow} disabled={syncing} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <RefreshCw size={14} /> {syncing ? 'Syncing…' : 'Sync now'}
                </button>
                <button className="btn-secondary" onClick={handleDisconnect} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--danger)' }}>
                  <Unlink size={14} /> Disconnect
                </button>
              </div>
            </div>
          ) : (
            <div>
              {!editingCalendar ? (
                <div>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                    Read-only overlay of your Outlook / Microsoft 365 calendar via Microsoft Graph. Entirely optional — OmniTool&apos;s
                    calendar works fine with only local events until this is configured. Requires an Azure AD (Entra ID) app
                    registration that you create yourself.
                  </p>
                  <button className="btn-capture" onClick={() => setEditingCalendar(true)}>
                    {calConfig?.configured ? 'Reconnect / edit credentials' : 'Set up Microsoft Graph'}
                  </button>
                </div>
              ) : (
                <div>
                  <ol style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1rem', paddingLeft: '1.1rem', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                    <li>In the Azure Portal, go to <b>Microsoft Entra ID → App registrations → New registration</b>.</li>
                    <li>Add a redirect URI of type <b>Web</b> with this exact value:</li>
                  </ol>
                  <code style={{ display: 'block', background: 'var(--bg-card)', padding: '0.6rem 0.8rem', borderRadius: 'var(--radius-md)', fontSize: '0.78rem', color: 'var(--cyan)', marginBottom: '1rem', wordBreak: 'break-all' }}>
                    {redirectUri}
                  </code>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                    Then add delegated API permission <b>Calendars.Read</b> (+ <b>offline_access</b>), create a client secret under
                    <b> Certificates &amp; secrets</b>, and paste the three values below.
                  </p>
                  <div style={{ display: 'grid', gap: '0.75rem', marginBottom: '1rem' }}>
                    <input className="input-field" placeholder="Directory (tenant) ID" value={tenantId} onChange={(e) => setTenantId(e.target.value)} />
                    <input className="input-field" placeholder="Application (client) ID" value={clientId} onChange={(e) => setClientId(e.target.value)} />
                    <input type="password" className="input-field" placeholder="Client secret value" value={clientSecret} onChange={(e) => setClientSecret(e.target.value)} />
                    <input className="input-field" placeholder="App base URL (e.g. http://localhost:3000)" value={appBaseUrl} onChange={(e) => setAppBaseUrl(e.target.value)} />
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button className="btn-secondary" onClick={() => setEditingCalendar(false)}>Cancel</button>
                    <button className="btn-capture" onClick={handleSaveCalendarConfig} disabled={savingCalendar}>
                      {savingCalendar ? 'Saving…' : 'Save & connect with Microsoft'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <section className="configuration-section" hidden={section !== 'integrations'}>
          <div className="card-title"><span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><CalendarDays size={20} /> Google Calendar</span><span className="badge">{googleConfig?.connected ? 'Connected' : 'Optional'}</span></div>
          {googleConfig?.connected ? (
            <div>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>Read-only primary calendar · last synced {googleConfig.last_synced_at ? new Date(googleConfig.last_synced_at).toLocaleString() : 'never'}</p>
              {googleConfig.last_sync_error && <p role="alert" style={{ color: 'var(--danger)' }}>{googleConfig.last_sync_error}</p>}
              <div className="form-actions"><button type="button" className="btn-secondary" disabled={googleBusy} onClick={syncGoogle}><RefreshCw size={14} /> Sync now</button><button type="button" className="btn-secondary" onClick={removeGoogle}><Unlink size={14} /> Disconnect</button></div>
            </div>
          ) : !editingGoogle ? (
            <div><p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>Connect a Google Cloud Web application with the Calendar API enabled. Only read-only event access is requested.</p><button className="btn-capture" type="button" onClick={() => setEditingGoogle(true)}>{googleConfig?.configured ? 'Reconnect Google' : 'Set up Google Calendar'}</button></div>
          ) : (
            <form onSubmit={saveGoogle}>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Enable Google Calendar API, create a Web application OAuth client and add this authorized redirect URI:</p>
              <code style={{ display: 'block', padding: '0.7rem', wordBreak: 'break-all', color: 'var(--cyan)' }}>{googleRedirectUri}</code>
              <div className="form-row">
                <div className="form-group"><label className="form-label" htmlFor="google-id">Client ID</label><input id="google-id" className="form-input" value={googleClientId} onChange={(event) => setGoogleClientId(event.target.value)} required /></div>
                <div className="form-group"><label className="form-label" htmlFor="google-secret">Client secret</label><input id="google-secret" type="password" className="form-input" value={googleClientSecret} onChange={(event) => setGoogleClientSecret(event.target.value)} required /></div>
                <div className="form-group"><label className="form-label" htmlFor="google-origin">App origin</label><input id="google-origin" type="url" className="form-input" value={appBaseUrl} onChange={(event) => setAppBaseUrl(event.target.value)} required /></div>
              </div>
              <div className="form-actions"><button type="button" className="btn-secondary" onClick={() => setEditingGoogle(false)}>Cancel</button><button type="submit" className="btn-capture" disabled={googleBusy}>{googleBusy ? 'Saving...' : 'Save & connect Google'}</button></div>
            </form>
          )}
          {googleStatus && <p role="status" style={{ color: 'var(--text-secondary)' }}>{googleStatus}</p>}
        </section>

        <div className="configuration-section" hidden={section !== 'system'} id="developer">
          <div className="card-title">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Database size={20} color="var(--emerald)" />
              <span>Developer & Data</span>
            </div>
          </div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div><b>Engine:</b> SQLite (WAL Mode)</div>
            <div><b>Location:</b> <code>omnitool.db</code> (Local file)</div>
            <div><b>Portability:</b> Platform Agnostic (Linux / Windows)</div>
          </div>
        </div>

        <div className="configuration-section" hidden={section !== 'security'}>
          <div className="card-title">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Shield size={20} color="var(--purple)" />
              <span>Security & Encryption</span>
            </div>
          </div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div><b>Vault Primitive:</b> WebCrypto API (AES-256-GCM)</div>
            <div>
              <b>Key Derivation:</b>{' '}
              {vaultInitialized === null
                ? 'Checking…'
                : vaultInitialized
                ? `PBKDF2-SHA256, ${vaultIterations?.toLocaleString() || '—'} iterations`
                : 'Not initialized yet — set a master password in Vault'}
            </div>
            <div><b>Zero Knowledge:</b> Server stores ciphertexts only, never a key or plaintext</div>
            <div><b>Calendar tokens:</b> encrypted at rest with a server-local AES-256-GCM key</div>
          </div>
        </div>
      </div>
    </div>
  );
}
