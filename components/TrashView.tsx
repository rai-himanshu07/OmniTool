'use client';
import { useEffect, useState } from 'react';
import { Archive, RotateCcw, Trash2 } from 'lucide-react';
import { requestJson } from '@/lib/client';

export default function TrashView() {
  const [data, setData] = useState<{ items: any[]; archived: any[] }>({ items: [], archived: [] });
  const [status, setStatus] = useState('');
  const [tab, setTab] = useState('trash');
  const [accountPassword, setAccountPassword] = useState('');
  const load = async () => { try { setData(await requestJson('/api/trash')); } catch (error) { setStatus(String(error)); } };
  useEffect(() => { load(); }, []);
  const act = async (item: any, permanent = false) => {
    try {
      let password = '';
      if (permanent) {
        if (!confirm('Permanently delete this item? This cannot be undone.')) return;
        password = accountPassword;
        if (!password) { setStatus('Enter your account password below to permanently delete an item.'); return; }
      }
      await requestJson('/api/trash', { method: permanent ? 'DELETE' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(permanent
        ? { id: item.id, password, confirmation: 'DELETE PERMANENTLY' }
        : tab === 'trash' ? { id: item.id, action: 'restore' } : { entity_type: item.entity_type, entity_id: item.id, action: 'unarchive' }) });
      setStatus(permanent ? 'Permanently deleted' : 'Restored'); await load();
    } catch (error) { setStatus(`Could not complete action: ${String(error)}. No partial restore was applied.`); }
  };
  return <div><div className="page-header"><h1>Archive & Trash</h1></div>
    <div className="tabs"><button className={`tab ${tab === 'trash' ? 'active' : ''}`} onClick={() => setTab('trash')}><Trash2 size={16} /> Trash</button><button className={`tab ${tab === 'archive' ? 'active' : ''}`} onClick={() => setTab('archive')}><Archive size={16} /> Archived</button></div>
    {status && <p role="status">{status}</p>}
    {tab === 'trash' && data.items.length > 0 && <label>Account password for permanent deletion<input className="form-input" type="password" autoComplete="current-password" value={accountPassword} onChange={(event) => setAccountPassword(event.target.value)} /></label>}
    <div className="entity-list">{(tab === 'trash' ? data.items : data.archived).map((item) => <div className="entity-card" key={item.id}>
      <div className="entity-card-header"><strong>{item.title}</strong><span className="badge">{item.entity_type}</span></div>
      {item.expires_at && <p className="work-muted">Review after {new Date(item.expires_at).toLocaleDateString()}</p>}
      <div className="form-actions"><button className="btn-secondary" onClick={() => act(item)}><RotateCcw size={16} /> Restore</button>{tab === 'trash' && <button className="btn-secondary" onClick={() => act(item, true)}><Trash2 size={16} /> Delete permanently</button>}</div>
    </div>)}</div>{!(tab === 'trash' ? data.items : data.archived).length && <p className="work-muted">Nothing here.</p>}</div>;
}