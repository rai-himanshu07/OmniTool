'use client';

import React, { useState, useEffect } from 'react';
import { ClipboardCheck, Plus, Pencil } from 'lucide-react';
import { QcTemplate } from '@/lib/db/schema';

export default function QcView() {
  const [templates, setTemplates] = useState<QcTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [itemLines, setItemLines] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      const qRes = await fetch('/api/qc');
      const qData = await qRes.json();
      setTemplates(qData.templates || []);
    } catch (err) {
      setError('Could not load templates. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const editTemplate = (template: QcTemplate) => {
    setEditingId(template.id);
    setTitle(template.title);
    setDescription(template.description || '');
    setItemLines((template.items || []).map((item) => item.title).join('\n'));
    setShowAddForm(true);
  };

  const closeForm = () => {
    setShowAddForm(false);
    setEditingId(null);
    setTitle('');
    setDescription('');
    setItemLines('');
  };

  const handleCreateTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const items = itemLines
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    try {
      const response = await fetch('/api/qc', {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(editingId ? { templateId: editingId } : {}),
          title: title.trim(),
          description: description.trim() || undefined,
          items
        })
      });
      if (!response.ok) throw new Error('Unable to save template');
      setError('');
      closeForm();
      fetchData();
    } catch (err) {
      setError('Could not save template. Please try again.');
      console.error(err);
    }
  };

  return (
    <div>
      <div className="page-actions-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-primary)' }}>QC Template Library</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Define reusable checklists here; attach an independent copy from a project.
          </p>
        </div>
        <button className="btn-capture" onClick={() => { closeForm(); setShowAddForm(true); }}>
          <Plus size={18} />
          <span>New QC Template</span>
        </button>
      </div>

      {showAddForm && (
        <form className="card" onSubmit={handleCreateTemplate} style={{ marginBottom: '1.5rem' }}>
          <div className="card-title">{editingId ? 'Edit QC Template' : 'Create QC Template'}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem', marginBottom: '1rem' }}>
            <input
              type="text"
              className="input-field"
              placeholder="Template Title (e.g. P&ID Delivery QC)"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>
          <textarea className="input-field" placeholder="Template description (optional)" value={description} onChange={(e) => setDescription(e.target.value)} style={{ marginBottom: '1rem' }} />
          {error && <p role="alert" className="work-error">{error}</p>}
          <textarea
            className="input-field"
            placeholder="Checklist Items (one per line)...&#10;e.g.&#10;Tags validated&#10;Equipment checked&#10;Connectivity verified"
            value={itemLines}
            onChange={(e) => setItemLines(e.target.value)}
            style={{ marginBottom: '1rem', height: '100px', fontFamily: 'var(--font-mono)' }}
            required
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <button type="button" className="btn-secondary" onClick={closeForm}>
              Cancel
            </button>
            <button type="submit" className="btn-capture">
              {editingId ? 'Save changes' : 'Save template'}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div style={{ color: 'var(--text-muted)' }}>Loading QC checklists...</div>
      ) : (
        <div className="template-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 300px), 1fr))', gap: '1rem' }}>
          {templates.map((tpl) => {
            return (
              <div key={tpl.id} className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)' }}>{tpl.title}</h3>
                  <button type="button" className="btn-secondary" onClick={() => editTemplate(tpl)} aria-label={`Edit ${tpl.title}`}><Pencil size={15} /></button>
                </div>

                {tpl.description && (
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                    {tpl.description}
                  </p>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {tpl.items?.map((item) => (
                    <div key={item.id} style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', fontSize: '0.85rem' }}>
                      <ClipboardCheck size={15} color="var(--text-muted)" /> {item.title}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
