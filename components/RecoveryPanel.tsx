'use client';
import { useEffect, useState } from 'react';
import { Download, ShieldCheck, RotateCcw, Archive } from 'lucide-react';
import { requestJson } from '@/lib/client';
export default function RecoveryPanel() {
  const [data, setData] = useState<any>({ backups: [] });
  const [password, setPassword] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [restore, setRestore] = useState<any>(null);
  const [days, setDays] = useState(30);
  const load = async () => { try { const result = await requestJson('/api/backup'); setData(result); setDays(result.retention_days); } catch (error) { setStatus(String(error)); } };
  useEffect(() => { load(); }, []);
  const action = async (action: string, id?: string) => {
    setBusy(true); setStatus('');
    try {
      if (['inspect', 'stage'].includes(action)) {
        if (!file) throw new Error('Choose a backup ZIP');
        if (action === 'stage' && !confirm('Prepare a fresh restored database? The running database will not be overwritten.')) return;
        const form = new FormData(); form.set('action', action); form.set('password', password); form.set('file', file);
        const result = await requestJson('/api/backup', { method: 'POST', body: form }); setRestore(result.destination ? result : null); setStatus(action === 'stage' ? 'Verified restore prepared' : 'Backup verified');
      } else if (action === 'download') {
        const response = await fetch('/api/backup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, id, password }) });
        if (!response.ok) throw new Error((await response.json()).error);
        const url = URL.createObjectURL(await response.blob()); const link = document.createElement('a'); link.href = url; link.download = `omnitool-backup-${id}.zip`; link.click(); URL.revokeObjectURL(url); setStatus('Downloaded. Store the archive securely; it contains credentials and private data.');
      } else { await requestJson('/api/backup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, id, password, days }) }); setStatus(action === 'create' ? 'Verified backup created' : 'Saved'); }
      await load();
    } catch (error) { setStatus(String(error)); }
    finally { setBusy(false); }
  };
  return <section className="settings-section"><h2><ShieldCheck size={18} /> Full Recovery Backup</h2>
    <p>Last backup: {data.last_created ? new Date(data.last_created).toLocaleString() : 'Not recorded'} · Last verified: {data.last_verified ? new Date(data.last_verified).toLocaleString() : 'Not recorded'}</p>
    <label>Account password<input className="form-input" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} /></label>
    <button className="btn-capture" disabled={busy || !password} onClick={() => action('create')}><Archive size={16} /> Create verified backup</button>
    {data.backups.map((backup: any) => <div className="recovery-row" key={backup.id}><span>{new Date(backup.created_at).toLocaleString()}</span><div className="form-actions"><button className="btn-secondary" disabled={busy || !password} onClick={() => action('verify', backup.id)}><ShieldCheck size={16} /> Verify</button><button className="btn-secondary" disabled={busy || !password} onClick={() => action('download', backup.id)}><Download size={16} /> Download</button></div></div>)}
    <h3>Restore to a Fresh Destination</h3><input type="file" accept=".zip" aria-label="Backup archive" onChange={(event) => { setFile(event.target.files?.[0] || null); setRestore(null); }} /><div className="form-actions"><button className="btn-secondary" disabled={busy || !password || !file} onClick={() => action('inspect')}><ShieldCheck size={16} /> Inspect backup</button><button className="btn-secondary" disabled={busy || !password || !file} onClick={() => action('stage')}><RotateCcw size={16} /> Prepare restore</button></div>
    {restore && <div role="status"><p>{restore.instructions}</p><label>DATABASE_PATH<input className="form-input" readOnly value={restore.destination} /></label><label>OMNITOOL_SECRET_PATH<input className="form-input" readOnly value={restore.secret_path} /></label></div>}
    <label>Trash review age, days<input className="form-input" type="number" min="1" max="365" value={days} onChange={(event) => setDays(Number(event.target.value))} /></label><button className="btn-secondary" disabled={busy || !password} onClick={() => action('retention')}>Save review age</button>
    <p className="work-muted">Trash is never automatically purged. Permanent deletion requires confirmation. Backup archives retain their own copies.</p>
    {status && <p role="status">{status}</p>}
  </section>;
}