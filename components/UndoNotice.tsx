'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { RotateCcw, X } from 'lucide-react';
import { requestJson } from '@/lib/client';
export default function UndoNotice() {
  const [id, setId] = useState('');
  const [error, setError] = useState('');
  useEffect(() => { const handler = (event: Event) => { setId((event as CustomEvent<string>).detail); setError(''); }; window.addEventListener('omnitool:trashed', handler); return () => window.removeEventListener('omnitool:trashed', handler); }, []);
  if (!id) return null;
  return <div className="undo-notice" role="status">Moved to Trash. <button className="btn-secondary" onClick={async () => { try { await requestJson('/api/trash', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'restore', id }) }); setId(''); window.location.reload(); } catch (cause) { setError(String(cause)); } }}><RotateCcw size={16} /> Undo</button><Link href="/trash">Trash</Link><button className="notification-trigger" title="Dismiss" onClick={() => setId('')}><X size={16} /></button>{error}</div>;
}