'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Inbox as InboxIcon, ArrowRight, Sparkles } from 'lucide-react';
import { InboxItem, Project } from '@/lib/db/schema';
import { useUnsavedChanges } from '@/lib/client';

export default function InboxView() {
  const [items, setItems] = useState<InboxItem[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<InboxItem | null>(null);

  const [convertType, setConvertType] = useState<'task' | 'followup' | 'note'>('task');
  const [targetTitle, setTargetTitle] = useState('');
  const [targetProjectId, setTargetProjectId] = useState('');
  const [targetPerson, setTargetPerson] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [suggestion, setSuggestion] = useState<{ kind: 'task' | 'followup' | 'note'; title: string; waiting_on_person: string; due_date?: string | null; rationale: string } | null>(null);
  const [suggesting, setSuggesting] = useState(false);
  const [error, setError] = useState('');
  const openedFocus = useRef('');
  useUnsavedChanges(!!selectedItem);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [iRes, pRes] = await Promise.all([fetch('/api/inbox'), fetch('/api/projects')]);
      const iData = await iRes.json();
      const pData = await pRes.json();
      setItems(iData.items || []);
      setProjects(pData.projects || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleStartConvert = (item: InboxItem) => {
    setSelectedItem(item);
    setTargetTitle(item.content);
    setConvertType('task'); setTargetProjectId(''); setTargetPerson(''); setTargetDate(''); setSuggestion(null); setError('');
  };
  useEffect(() => { const id = new URLSearchParams(window.location.search).get('focus'); const target = items.find((item) => item.id === id); if (target && openedFocus.current !== id) { openedFocus.current = id || ''; handleStartConvert(target); } }, [items]);

  const suggest = async () => {
    if (!selectedItem) return;
    setSuggesting(true); setSuggestion(null); setError('');
    try {
      const response = await fetch('/api/ai/suggest', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: selectedItem.content }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not suggest an action');
      setSuggestion(data.suggestion);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not suggest an action'); }
    finally { setSuggesting(false); }
  };

  const useSuggestion = () => {
    if (!suggestion) return;
    setConvertType(suggestion.kind); setTargetTitle(suggestion.title);
    setTargetPerson(suggestion.waiting_on_person); setTargetDate(suggestion.due_date || ''); setSuggestion(null);
  };

  const handleProcessConversion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem || !targetTitle.trim()) return;

    try {
      const response = await fetch('/api/inbox/convert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedItem.id,
          kind: convertType,
          title: targetTitle.trim(),
          project_id: targetProjectId || null,
          waiting_on_person: targetPerson.trim(),
          due_date: convertType === 'note' ? null : targetDate || null,
        })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not process capture');

      setSelectedItem(null); setSuggestion(null); setError('');
      fetchData();
      window.dispatchEvent(new Event('omnitool:refresh'));
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not process capture'); }
  };

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-primary)' }}>Inbox Triage</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          Process raw captured thoughts into structured commitments and project entities
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: selectedItem ? '1fr 1fr' : '1fr', gap: '1.5rem' }}>
        <div>
          {loading ? (
            <div style={{ color: 'var(--text-muted)' }}>Loading inbox items...</div>
          ) : items.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
              <InboxIcon size={36} color="var(--cyan)" style={{ marginBottom: '0.75rem' }} />
              <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Inbox Clear!</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                All quick capture items have been triaged. Use <b>Ctrl+Space</b> anytime to capture new commitments.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {items.map((item) => (
                <div key={item.id} className="card" style={{ margin: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.95rem' }}>
                      {item.content}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                      Captured: {new Date(item.created_at).toLocaleString()}
                    </div>
                  </div>
                  <button className="btn-capture" onClick={() => handleStartConvert(item)} style={{ fontSize: '0.8rem', padding: '0.4rem 0.85rem' }}>
                    <span>Process</span>
                    <ArrowRight size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {selectedItem && (
          <form className="card" onSubmit={handleProcessConversion}>
            <div className="card-title">Process Capture</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
              <button type="button" className="btn-secondary" disabled={suggesting} onClick={suggest}><Sparkles size={15} /> {suggesting ? 'Thinking...' : 'Suggest with AI'}</button>
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>Sends this capture to your configured provider.</span>
            </div>
            {suggestion && <div className="inbox-suggestion"><strong>{suggestion.title}</strong><span>{suggestion.kind}{suggestion.due_date ? ` · ${suggestion.due_date}` : ''}{suggestion.waiting_on_person ? ` · ${suggestion.waiting_on_person}` : ''}</span>{suggestion.rationale && <small>{suggestion.rationale}</small>}<div style={{ display: 'flex', gap: '0.5rem' }}><button type="button" className="btn-capture" onClick={useSuggestion}>Use suggestion</button><button type="button" className="btn-secondary" onClick={() => setSuggestion(null)}>Dismiss</button></div></div>}
            {error && <p role="alert" className="work-error">{error}</p>}

            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
              <button
                type="button"
                className={`btn-secondary ${convertType === 'task' ? 'active' : ''}`}
                onClick={() => setConvertType('task')}
                style={{ flex: 1, borderColor: convertType === 'task' ? 'var(--primary)' : undefined }}
              >
                Task
              </button>
              <button
                type="button"
                className={`btn-secondary ${convertType === 'followup' ? 'active' : ''}`}
                onClick={() => setConvertType('followup')}
                style={{ flex: 1, borderColor: convertType === 'followup' ? 'var(--primary)' : undefined }}
              >
                Follow-up
              </button>
              <button
                type="button"
                className={`btn-secondary ${convertType === 'note' ? 'active' : ''}`}
                onClick={() => setConvertType('note')}
                style={{ flex: 1, borderColor: convertType === 'note' ? 'var(--primary)' : undefined }}
              >
                Note
              </button>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>
                Title / Summary
              </label>
              <input
                type="text"
                className="input-field"
                value={targetTitle}
                onChange={(e) => setTargetTitle(e.target.value)}
                required
              />
            </div>

            {convertType === 'followup' && (
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>
                  Waiting On Person / Team
                </label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="e.g. Ravi or Client ABC"
                  value={targetPerson}
                  onChange={(e) => setTargetPerson(e.target.value)}
                  required
                />
              </div>
            )}

            {convertType !== 'note' && <div style={{ marginBottom: '1rem' }}><label htmlFor="inbox-target-date" className="form-label">{convertType === 'task' ? 'Due date' : 'Expected date'}</label><input id="inbox-target-date" className="input-field" type="date" value={targetDate} onChange={(event) => setTargetDate(event.target.value)} /></div>}

            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>
                Project Link
              </label>
              <select className="input-field" value={targetProjectId} onChange={(e) => setTargetProjectId(e.target.value)}>
                <option value="">Select Project (Optional)</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button type="button" className="btn-secondary" onClick={() => setSelectedItem(null)}>
                Cancel
              </button>
              <button type="submit" className="btn-capture">
                Convert & Save
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
