'use client';

import React, { useState, useEffect, useRef } from 'react';
import { FileText, Plus, Search, Pencil, Trash2, Link2, X } from 'lucide-react';
import { Note, Project, Client, Task, Followup } from '@/lib/db/schema';
import { requestJson, useUnsavedChanges } from '@/lib/client';
import Link from 'next/link';

interface NoteLink {
  id: string;
  linked_entity_type: string;
  linked_entity_id: string;
  label: string | null;
}

interface NoteDetail extends Note {
  links: NoteLink[];
}

const LINK_TYPES = [
  { value: 'project', label: 'Project' },
  { value: 'task', label: 'Task' },
  { value: 'followup', label: 'Follow-up' },
  { value: 'client', label: 'Client' },
];

export default function NotesView() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [followups, setFollowups] = useState<Followup[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [projectId, setProjectId] = useState('');
  const [search, setSearch] = useState('');

  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [activeNote, setActiveNote] = useState<NoteDetail | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editProjectId, setEditProjectId] = useState('');
  const [linkType, setLinkType] = useState('project');
  const [linkTargetId, setLinkTargetId] = useState('');
  const [visibility, setVisibility] = useState('private');
  const [editVisibility, setEditVisibility] = useState('shared');
  const [status, setStatus] = useState('');
  const openedFocus = useRef('');
  const noteDirty = !!activeNote && (editTitle !== activeNote.title || editContent !== activeNote.content || editProjectId !== (activeNote.project_id || '') || editVisibility !== (activeNote.visibility || 'shared'));
  useUnsavedChanges(!!title || !!content || noteDirty);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [nRes, pRes, cRes, tRes, fRes] = await Promise.all([
        fetch('/api/notes'),
        fetch('/api/projects'),
        fetch('/api/clients'),
        fetch('/api/tasks'),
        fetch('/api/followups'),
      ]);
      const [nData, pData, cData, tData, fData] = await Promise.all([nRes.json(), pRes.json(), cRes.json(), tRes.json(), fRes.json()]);
      setNotes(nData.notes || []);
      setProjects(pData.projects || []);
      setClients(cData.clients || []);
      setTasks(tData.tasks || []);
      setFollowups(fData.followups || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;

    try {
      await requestJson('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          content: content.trim(),
          project_id: projectId || undefined, visibility
        })
      });
      setTitle('');
      setContent('');
      setProjectId('');
      setShowAddForm(false);
      fetchData();
    } catch (err) {
      setStatus(String(err));
    }
  };

  const openNote = async (note: Note) => {
    if (noteDirty && !confirm('Discard unsaved note edits?')) return;
    if (activeNoteId === note.id) {
      setActiveNoteId(null);
      setActiveNote(null);
      return;
    }
    setActiveNoteId(note.id);
    setEditTitle(note.title);
    setEditContent(note.content);
    setEditProjectId(note.project_id || '');
      setEditVisibility(note.visibility || 'shared');
    try {
      const res = await fetch(`/api/notes/${note.id}`);
      const data = await res.json();
      setActiveNote(data.note);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveNote = async () => {
    if (!activeNoteId) return;
    try {
      const res = await fetch(`/api/notes/${activeNoteId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editTitle.trim(),
          content: editContent.trim(),
          project_id: editProjectId || null,
          ...(editVisibility !== activeNote?.visibility ? { visibility: editVisibility } : {}),
          if_match_updated_at: activeNote?.updated_at,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Unable to save note');
      await fetchData();
      setActiveNoteId(null);
      setActiveNote(null);
    } catch (err) {
      setStatus(String(err));
    }
  };

  const handleDeleteNote = async (id: string) => {
    if (!confirm('Move this note to Trash?')) return;
    try {
      await requestJson(`/api/notes/${id}`, { method: 'DELETE' });
      setActiveNoteId(null);
      setActiveNote(null);
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const targetOptions = () => {
    if (linkType === 'project') return projects.map((p) => ({ id: p.id, label: p.name }));
    if (linkType === 'task') return tasks.map((t) => ({ id: t.id, label: t.title }));
    if (linkType === 'followup') return followups.map((f) => ({ id: f.id, label: f.title }));
    if (linkType === 'client') return clients.map((c) => ({ id: c.id, label: c.name }));
    return [];
  };

  const handleAddLink = async () => {
    if (!activeNoteId || !linkTargetId) return;
    try {
      await fetch(`/api/notes/${activeNoteId}/links`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ linked_entity_type: linkType, linked_entity_id: linkTargetId }),
      });
      setLinkTargetId('');
      const res = await fetch(`/api/notes/${activeNoteId}`);
      const data = await res.json();
      setActiveNote(data.note);
    } catch (err) {
      console.error(err);
    }
  };

  const handleRemoveLink = async (linkId: string) => {
    if (!activeNoteId) return;
    try {
      await fetch(`/api/notes/${activeNoteId}/links?link_id=${linkId}`, { method: 'DELETE' });
      const res = await fetch(`/api/notes/${activeNoteId}`);
      const data = await res.json();
      setActiveNote(data.note);
    } catch (err) {
      console.error(err);
    }
  };

  const filteredNotes = notes.filter(
    (n) =>
      n.title.toLowerCase().includes(search.toLowerCase()) ||
      n.content.toLowerCase().includes(search.toLowerCase())
  );

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('focus');
    const note = notes.find((entry) => entry.id === id);
    if (!note || openedFocus.current === id) return;
    openedFocus.current = id || '';
    setActiveNoteId(note.id); setEditTitle(note.title); setEditContent(note.content);
    setEditProjectId(note.project_id || ''); setEditVisibility(note.visibility || 'shared');
    requestJson(`/api/notes/${note.id}`).then((data) => setActiveNote(data.note)).catch((error) => setStatus(String(error)));
  }, [notes]);

  return (
    <div>
      <div className="page-actions-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-primary)' }}>Contextual Notes</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Lightweight operational notes linked to projects and commitments
          </p>
        </div>
        <button className="btn-capture" onClick={() => setShowAddForm(!showAddForm)}>
          <Plus size={18} />
          <span>New Note</span>
        </button>
      </div>

      {status && <p role="alert" className="work-error">{status}</p>}
      <div style={{ marginBottom: '1.5rem', position: 'relative' }}>
        <input
          type="text"
          className="input-field"
          placeholder="Search notes by keyword or relationship context..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ paddingLeft: '2.5rem' }}
        />
        <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
      </div>

      {showAddForm && (
        <form className="card" onSubmit={handleCreateNote} style={{ marginBottom: '1.5rem' }}>
          <div className="card-title">Create Note</div>
                    <label>Visibility<select className="form-select" value={visibility} onChange={(event) => setVisibility(event.target.value)}><option value="private">Private</option><option value="shared">Shared workspace</option></select></label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
            <input
              type="text"
              className="input-field"
              placeholder="Note Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
            <select className="input-field" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
              <option value="">Link to Project (Optional)</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <textarea
            className="input-field"
            placeholder="Note content..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            style={{ marginBottom: '1rem', height: '120px' }}
            required
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <button type="button" className="btn-secondary" onClick={() => setShowAddForm(false)}>
              Cancel
            </button>
            <button type="submit" className="btn-capture">
              Save Note
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div style={{ color: 'var(--text-muted)' }}>Loading notes...</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem' }}>
          {filteredNotes.map((note) => {
            const isActive = activeNoteId === note.id;
            return (
              <div key={note.id} className="card" style={{ display: 'flex', flexDirection: 'column', cursor: isActive ? 'default' : 'pointer' }}>
                {!isActive ? (
                  <div onClick={() => openNote(note)} style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                      <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>{note.title}</h3>
                                            <span className="badge">{note.visibility || 'shared'}</span>
                      {note.project_name && <span className="badge badge-purple">{note.project_name}</span>}
                    </div>
                    <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', flex: 1, marginBottom: '1rem' }}>
                      {note.content}
                    </p>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', paddingTop: '0.5rem', borderTop: '1px solid var(--border-subtle)' }}>
                      Updated: {new Date(note.updated_at).toLocaleDateString()}
                    </div>
                  </div>
                ) : (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>Editing note</span>
                      <button onClick={() => { if (!noteDirty || confirm('Discard unsaved note edits?')) { setActiveNoteId(null); setActiveNote(null); } }} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                        <X size={16} />
                      </button>
                    </div>
                    <input
                      type="text"
                      className="input-field"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      style={{ marginBottom: '0.75rem' }}
                    />
                    <select className="input-field" value={editProjectId} onChange={(e) => setEditProjectId(e.target.value)} style={{ marginBottom: '0.75rem' }}>
                      <option value="">No project link</option>
                      {projects.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                    <textarea
                      className="input-field"
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      style={{ marginBottom: '0.75rem', height: '120px' }}
                    />
                    <label>Visibility<select className="form-select" value={editVisibility} onChange={(event) => setEditVisibility(event.target.value)}><option value="private">Private</option><option value="shared">Shared workspace</option></select></label>

                    <div style={{ marginBottom: '0.75rem' }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <Link2 size={12} /> Linked to
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.5rem' }}>
                        {(activeNote?.links || []).map((l) => (
                          <span key={l.id} className="badge" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                            <Link href={l.linked_entity_type === 'task' ? `/tasks/${l.linked_entity_id}` : l.linked_entity_type === 'project' ? `/projects/${l.linked_entity_id}` : l.linked_entity_type === 'followup' ? `/followups?focus=${l.linked_entity_id}` : '/calendar'}>{l.linked_entity_type}: {l.label || 'Unknown'}</Link>
                            <X size={11} style={{ cursor: 'pointer' }} onClick={() => handleRemoveLink(l.id)} />
                          </span>
                        ))}
                        {(!activeNote?.links || activeNote.links.length === 0) && (
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>No links yet</span>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: '0.4rem' }}>
                        <select className="input-field" value={linkType} onChange={(e) => { setLinkType(e.target.value); setLinkTargetId(''); }} style={{ flex: '0 0 130px' }}>
                          {LINK_TYPES.map((t) => (
                            <option key={t.value} value={t.value}>{t.label}</option>
                          ))}
                        </select>
                        <select className="input-field" value={linkTargetId} onChange={(e) => setLinkTargetId(e.target.value)} style={{ flex: 1 }}>
                          <option value="">Select {linkType}...</option>
                          {targetOptions().map((o) => (
                            <option key={o.id} value={o.id}>{o.label}</option>
                          ))}
                        </select>
                        <button type="button" className="btn-secondary" onClick={handleAddLink} disabled={!linkTargetId}>Add</button>
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem' }}>
                                            <button className="btn-secondary" onClick={async () => { try { await requestJson('/api/trash', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'archive', entity_type: 'note', entity_id: note.id }) }); setActiveNote(null); setActiveNoteId(null); fetchData(); } catch (error) { setStatus(String(error)); } }}>Archive</button>
                      <button type="button" className="btn-secondary" onClick={() => handleDeleteNote(note.id)} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--danger)' }}>
                        <Trash2 size={14} /> Delete
                      </button>
                      <button type="button" className="btn-capture" onClick={handleSaveNote} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <Pencil size={14} /> Save changes
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
