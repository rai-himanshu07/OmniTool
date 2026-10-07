'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Pencil, Trash2, Plus, CheckSquare, Square, Calendar as CalendarIcon, CheckCircle2, RotateCcw,
  FileText, ClipboardCheck, Activity as ActivityIcon, ListTodo, MessageSquare, RefreshCw, UsersRound, X
} from 'lucide-react';
import { Client } from '@/lib/db/schema';
import { requestJson, useUnsavedChanges } from '@/lib/client';

interface Props {
  projectId: string;
}

const TABS = ['Overview', 'Work', 'Follow-ups', 'QC', 'Notes', 'Calendar', 'Activity'] as const;
type TabName = typeof TABS[number];

export default function ProjectDetailView({ projectId }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabName>('Overview');
  const [clients, setClients] = useState<Client[]>([]);
  const [availableTeams, setAvailableTeams] = useState<any[]>([]);
  const [availablePeople, setAvailablePeople] = useState<any[]>([]);
  const [projectTeams, setProjectTeams] = useState<any[]>([]);
  const [projectPeople, setProjectPeople] = useState<any[]>([]);
  const [teamPeople, setTeamPeople] = useState<any[]>([]);
  const [newTeamId, setNewTeamId] = useState('');
  const [newPersonId, setNewPersonId] = useState('');
  const [teamError, setTeamError] = useState('');

  const [project, setProject] = useState<any>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [followups, setFollowups] = useState<any[]>([]);
  const [workstreams, setWorkstreams] = useState<any[]>([]);
  const [deliverables, setDeliverables] = useState<any[]>([]);
  const [qcChecklists, setQcChecklists] = useState<any[]>([]);
  const [availableTemplates, setAvailableTemplates] = useState<any[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [qcTargetType, setQcTargetType] = useState<'project' | 'task' | 'deliverable'>('project');
  const [qcTargetId, setQcTargetId] = useState('');
  const [qcError, setQcError] = useState('');
  const [notes, setNotes] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [activity, setActivity] = useState<any[]>([]);

  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<any>({});
  const [saveStatus, setSaveStatus] = useState('');
  const dirty = editing && !!project && Object.entries(editForm).some(([key, value]) => key !== 'if_match_updated_at' && (value || '') !== (project[key] || ''));
  useUnsavedChanges(dirty);

  const fetchDetail = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}`);
      if (!res.ok) {
        setProject(null);
        return;
      }
      const data = await res.json();
      setProject(data.project);
      setTasks(data.tasks || []);
      setFollowups(data.followups || []);
      setWorkstreams(data.workstreams || []);
      setProjectTeams(data.project_teams || []);
      setProjectPeople(data.project_people || []);
      setTeamPeople(data.team_people || []);
      setDeliverables(data.deliverables || []);
      setQcChecklists(data.qc_checklists || []);
      setNotes(data.notes || []);
      setEvents(data.events || []);
      setActivity(data.activity || []);
      setEditForm({
        name: data.project.name,
        code: data.project.code || '',
        description: data.project.description || '',
        owner: data.project.owner,
        owner_person_id: data.project.owner_person_id || null,
        priority: data.project.priority,
        client_id: data.project.client_id || '',
        status_override: data.project.status_override || '',
        start_date: data.project.start_date || '',
        planned_delivery_date: data.project.planned_delivery_date || '',
        actual_delivery_date: data.project.actual_delivery_date || '',
        if_match_updated_at: data.project.updated_at,
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchDetail();
    fetch('/api/clients').then((r) => r.json()).then((d) => setClients(d.clients || [])).catch(console.error);
    fetch('/api/qc').then((r) => r.json()).then((d) => setAvailableTemplates(d.templates || [])).catch(console.error);
    fetch('/api/teams').then((r) => r.json()).then((d) => setAvailableTeams(d.teams || [])).catch(console.error);
    fetch('/api/people').then((r) => r.json()).then((d) => setAvailablePeople(d.people || [])).catch(console.error);
  }, [fetchDetail]);

  const handleSaveEdit = async () => {
    try {
    await requestJson(`/api/projects/${projectId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...editForm,
        client_id: editForm.client_id || null,
        status_override: editForm.status_override || null,
      }),
    });
    setEditing(false);
    fetchDetail();
    setSaveStatus('Saved');
    } catch (error) { setSaveStatus(String(error)); }
  };

  const handleDeleteProject = async () => {
    if (!confirm(`Move "${project.name}" to Trash? Linked work will be preserved for restoration.`)) return;
    try { await requestJson(`/api/projects/${projectId}`, { method: 'DELETE' }); router.push('/projects'); }
    catch (error) { setSaveStatus(String(error)); }
  };

  const setProjectCompletion = async () => {
    const completed = project.lifecycle_status === 'completed';
    if (!completed) {
      const openTasks = tasks.filter((task) => !['done', 'cancelled'].includes(task.status)).length;
      const openFollowups = followups.filter((followup) => !['resolved', 'cancelled'].includes(followup.status)).length;
      if (!confirm(`Complete this project? ${openTasks} open tasks and ${openFollowups} follow-ups will remain unchanged. Cadence rules will pause.`)) return;
    }
    try {
      await requestJson(`/api/projects/${projectId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: completed ? 'active' : 'completed', if_match_updated_at: project.updated_at }) });
      setSaveStatus(completed ? 'Project reopened. Resume cadence rules explicitly if needed.' : 'Project completed.'); await fetchDetail();
    } catch (error) { setSaveStatus(String(error)); }
  };

  const toggleTaskStatus = async (task: any) => {
    const newStatus = task.status === 'done' ? 'open' : 'done';
    await fetch(`/api/tasks/${task.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    });
    fetchDetail();
  };

  const resolveFollowup = async (id: string) => {
    await fetch('/api/followups', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status: 'resolved' }),
    });
    fetchDetail();
  };

  const toggleQcItem = async (item: any) => {
    const response = await fetch('/api/qc', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemId: item.id, is_checked: item.is_checked ? 0 : 1 }),
    });
    if (!response.ok) { setQcError('Could not update checklist item'); return; }
    fetchDetail();
  };

  const changeProjectTeam = async (type: 'team' | 'person', id: string, remove = false) => {
    const endpoint = `/api/projects/${projectId}/team`;
    const response = await fetch(remove ? `${endpoint}?type=${type}&id=${encodeURIComponent(id)}` : endpoint, {
      method: remove ? 'DELETE' : 'POST', headers: { 'Content-Type': 'application/json' },
      ...(remove ? {} : { body: JSON.stringify(type === 'team' ? { team_id: id } : { person_id: id }) }),
    });
    if (!response.ok) { setTeamError('Could not update project team.'); return; }
    setTeamError(''); setNewTeamId(''); setNewPersonId(''); fetchDetail();
  };

  const attachChecklist = async () => {
    if (!selectedTemplateId || (qcTargetType !== 'project' && !qcTargetId)) return;
    const response = await fetch('/api/qc', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ template_id: selectedTemplateId, project_id: projectId,
        ...(qcTargetType === 'task' ? { task_id: qcTargetId } : {}),
        ...(qcTargetType === 'deliverable' ? { deliverable_id: qcTargetId } : {}) }),
    });
    if (!response.ok) { setQcError('Could not attach template'); return; }
    setQcError('');
    setSelectedTemplateId('');
    setQcTargetId('');
    fetchDetail();
  };

  const [newDeliverableTitle, setNewDeliverableTitle] = useState('');
  const [newDeliverableDate, setNewDeliverableDate] = useState('');
  const addDeliverable = async () => {
    if (!newDeliverableTitle.trim()) return;
    await fetch(`/api/projects/${projectId}/deliverables`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: newDeliverableTitle.trim(), due_date: newDeliverableDate || undefined }),
    });
    setNewDeliverableTitle('');
    setNewDeliverableDate('');
    fetchDetail();
  };

  const toggleDeliverable = async (d: any) => {
    const newStatus = d.status === 'completed' ? 'pending' : 'completed';
    await fetch(`/api/deliverables/${d.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    });
    fetchDetail();
  };

  const [newWorkstreamName, setNewWorkstreamName] = useState('');
  const addWorkstream = async () => {
    if (!newWorkstreamName.trim()) return;
    await fetch(`/api/projects/${projectId}/workstreams`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newWorkstreamName.trim() }),
    });
    setNewWorkstreamName('');
    fetchDetail();
  };

  const [newNoteTitle, setNewNoteTitle] = useState('');
  const [newNoteContent, setNewNoteContent] = useState('');
  const addNote = async () => {
    if (!newNoteTitle.trim() || !newNoteContent.trim()) return;
    await fetch('/api/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: newNoteTitle.trim(), content: newNoteContent.trim(), project_id: projectId }),
    });
    setNewNoteTitle('');
    setNewNoteContent('');
    fetchDetail();
  };

  const [newTaskTitle, setNewTaskTitle] = useState('');
  const addTask = async () => {
    if (!newTaskTitle.trim()) return;
    await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: newTaskTitle.trim(), project_id: projectId }),
    });
    setNewTaskTitle('');
    fetchDetail();
  };

  const [newFollowupTitle, setNewFollowupTitle] = useState('');
  const [newFollowupPerson, setNewFollowupPerson] = useState('');
  const addFollowup = async () => {
    if (!newFollowupTitle.trim() || !newFollowupPerson.trim()) return;
    await fetch('/api/followups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: newFollowupTitle.trim(), waiting_on_person: newFollowupPerson.trim(), project_id: projectId }),
    });
    setNewFollowupTitle('');
    setNewFollowupPerson('');
    fetchDetail();
  };

  if (loading) {
    return <div style={{ color: 'var(--text-muted)', padding: '2rem' }}>Loading project...</div>;
  }

  if (!project) {
    return (
      <div style={{ padding: '2rem' }}>
        <p style={{ color: 'var(--text-muted)' }}>Project not found.</p>
        <button className="btn-secondary" onClick={() => router.push('/projects')} style={{ marginTop: '1rem' }}>
          <ArrowLeft size={14} /> Back to Projects
        </button>
      </div>
    );
  }

  const statusBadge = project.status === 'red' ? 'red' : project.status === 'amber' ? 'amber' : 'green';

  return (
    <div>
      <button
        onClick={() => { if (!dirty || confirm('Leave without saving project edits?')) router.push('/projects'); }}
        style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', marginBottom: '1rem', fontSize: '0.85rem', padding: 0 }}
      >
        <ArrowLeft size={14} /> Back to Projects
      </button>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', gap: '1rem', flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>{project.client_name || 'Internal'}</div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            {project.name}
            <span className={`badge badge-${statusBadge}`}>{project.status.toUpperCase()}</span>
          </h1>
          {project.description && !editing && (
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.35rem', maxWidth: '640px' }}>{project.description}</p>
          )}
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <Link href={`/cadence?project_id=${projectId}`} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', textDecoration: 'none' }}><RefreshCw size={14} /> Cadence</Link>
          <button className="btn-secondary" disabled={dirty} onClick={setProjectCompletion}>{project.lifecycle_status === 'completed' ? <RotateCcw size={15} /> : <CheckCircle2 size={15} />} {project.lifecycle_status === 'completed' ? 'Reopen project' : 'Complete project'}</button>
          <button className="btn-secondary" onClick={async () => { try { await requestJson('/api/trash', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'archive', entity_type: 'project', entity_id: projectId }) }); router.push('/projects'); } catch (error) { setSaveStatus(String(error)); } }}>Archive</button>
          <button className="btn-secondary" onClick={() => { if (!dirty || confirm('Discard unsaved project edits?')) setEditing(!editing); }} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <Pencil size={14} /> {editing ? 'Cancel' : 'Edit'}
          </button>
          <button className="btn-secondary" onClick={handleDeleteProject} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--danger)' }}>
            <Trash2 size={14} /> Delete
          </button>
        </div>
      </div>

      {editing && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <div className="card-title">Edit Project</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
            <input className="input-field" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} placeholder="Name" />
            <input className="input-field" value={editForm.code} onChange={(e) => setEditForm({ ...editForm, code: e.target.value })} placeholder="Code" />
            <select className="input-field" value={editForm.client_id} onChange={(e) => setEditForm({ ...editForm, client_id: e.target.value })}>
              <option value="">No client</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <select className="input-field" aria-label="Project owner" value={editForm.owner_person_id || ''} onChange={(e) => { const person = availablePeople.find((entry: any) => entry.id === e.target.value); setEditForm({ ...editForm, owner_person_id: e.target.value || null, owner: person?.name || 'Unassigned' }); }}>
              <option value="">No linked owner</option>{availablePeople.filter((person: any) => person.active || person.id === project.owner_person_id).map((person: any) => <option key={person.id} value={person.id}>{person.name}</option>)}
            </select>
            <select className="input-field" value={editForm.priority} onChange={(e) => setEditForm({ ...editForm, priority: e.target.value })}>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
            <select className="input-field" value={editForm.status_override} onChange={(e) => setEditForm({ ...editForm, status_override: e.target.value })}>
              <option value="">Auto health (derived)</option>
              <option value="green">Override: Green</option>
              <option value="amber">Override: Amber</option>
              <option value="red">Override: Red</option>
            </select>
            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Start date</label>
              <input type="date" className="input-field" value={editForm.start_date} onChange={(e) => setEditForm({ ...editForm, start_date: e.target.value })} />
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Planned delivery</label>
              <input type="date" className="input-field" value={editForm.planned_delivery_date} onChange={(e) => setEditForm({ ...editForm, planned_delivery_date: e.target.value })} />
            </div>
          </div>
          <textarea
            className="input-field"
            value={editForm.description}
            onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
            style={{ height: '90px', marginBottom: '1rem' }}
            placeholder="Objective / description"
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button className="btn-capture" onClick={handleSaveEdit}>Save changes</button>
          </div>
        </div>
      )}

      <div className="tabs">
        {saveStatus && <p role="status">{saveStatus}</p>}
        {TABS.map((t) => (
          <button key={t} className={`tab ${activeTab === t ? 'active' : ''}`} onClick={() => setActiveTab(t)}>{t}</button>
        ))}
      </div>

      {activeTab === 'Overview' && (
        <div className="project-overview-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
          <section className="card" style={{ gridColumn: '1 / -1' }}>
            <div className="card-title"><UsersRound size={18} /> Team <Link href="/teams" style={{ marginLeft: 'auto', fontSize: '0.8rem' }}>Manage people</Link></div>
            {projectTeams.map((team: any) => <div className="work-row" key={team.id}><span className="work-row-content"><strong>{team.name}</strong></span><button className="btn-secondary" aria-label={`Remove ${team.name}`} onClick={() => changeProjectTeam('team', team.id, true)}><X size={14} /></button></div>)}
            {projectPeople.map((person: any) => <div className="work-row" key={person.id}><span className="work-row-content"><strong>{person.name}</strong><small>Direct · {person.role}</small></span><button className="btn-secondary" aria-label={`Remove ${person.name}`} onClick={() => changeProjectTeam('person', person.id, true)}><X size={14} /></button></div>)}
            {teamPeople.length > 0 && <p style={{ margin: '0.65rem 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Through teams: {teamPeople.map((person: any) => person.name).join(', ')}</p>}
            <div className="form-row" style={{ marginTop: '1rem' }}>
              <div style={{ display: 'flex', gap: '0.4rem' }}><select className="form-select" aria-label="Team" value={newTeamId} onChange={(event) => setNewTeamId(event.target.value)}><option value="">Add team</option>{availableTeams.filter((team: any) => team.active && !projectTeams.some((linked: any) => linked.id === team.id)).map((team: any) => <option key={team.id} value={team.id}>{team.name}</option>)}</select><button className="btn-secondary" disabled={!newTeamId} aria-label="Attach team" onClick={() => changeProjectTeam('team', newTeamId)}><Plus size={14} /></button></div>
              <div style={{ display: 'flex', gap: '0.4rem' }}><select className="form-select" aria-label="Person" value={newPersonId} onChange={(event) => setNewPersonId(event.target.value)}><option value="">Add person</option>{availablePeople.filter((person: any) => person.active && !projectPeople.some((linked: any) => linked.id === person.id)).map((person: any) => <option key={person.id} value={person.id}>{person.name}</option>)}</select><button className="btn-secondary" disabled={!newPersonId} aria-label="Attach person" onClick={() => changeProjectTeam('person', newPersonId)}><Plus size={14} /></button></div>
            </div>
            {teamError && <p role="alert" className="work-error">{teamError}</p>}
          </section>
          <div className="card">
            <div className="card-title">Key Dates &amp; Ownership</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              <div><b style={{ color: 'var(--text-primary)' }}>Owner:</b> {project.owner}</div>
              <div><b style={{ color: 'var(--text-primary)' }}>Priority:</b> {project.priority}</div>
              <div><b style={{ color: 'var(--text-primary)' }}>Start:</b> {project.start_date || 'Not set'}</div>
              <div><b style={{ color: 'var(--text-primary)' }}>Planned delivery:</b> {project.planned_delivery_date || 'Not set'}</div>
              <div><b style={{ color: 'var(--text-primary)' }}>Actual delivery:</b> {project.actual_delivery_date || 'Not yet delivered'}</div>
            </div>
          </div>

          <div className="card">
            <div className="card-title">Deliverables</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
              {deliverables.length === 0 && <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No deliverables yet</span>}
              {deliverables.map((d: any) => (
                <div
                  key={d.id}
                  onClick={() => toggleDeliverable(d)}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem', color: d.status === 'completed' ? 'var(--text-muted)' : 'var(--text-primary)', textDecoration: d.status === 'completed' ? 'line-through' : 'none' }}
                >
                  {d.status === 'completed' ? <CheckSquare size={16} color="var(--success)" /> : <Square size={16} />}
                  <span>{d.title}</span>
                  {d.due_date && <span style={{ color: 'var(--text-muted)', marginLeft: 'auto' }}>{d.due_date}</span>}
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '0.4rem' }}>
              <input className="input-field" placeholder="New deliverable" value={newDeliverableTitle} onChange={(e) => setNewDeliverableTitle(e.target.value)} />
              <input type="date" className="input-field" style={{ flex: '0 0 150px' }} value={newDeliverableDate} onChange={(e) => setNewDeliverableDate(e.target.value)} />
              <button className="btn-secondary" onClick={addDeliverable}><Plus size={14} /></button>
            </div>
          </div>

          <div className="card" style={{ gridColumn: '1 / -1' }}>
            <div className="card-title">Workstreams</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
              {workstreams.length === 0 && (
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No workstreams yet — group tasks by phase (e.g. Extraction, QC, Delivery)</span>
              )}
              {workstreams.map((w: any) => (
                <span key={w.id} className="badge badge-purple">{w.name}</span>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '0.4rem', maxWidth: '420px' }}>
              <input className="input-field" placeholder="New workstream name" value={newWorkstreamName} onChange={(e) => setNewWorkstreamName(e.target.value)} />
              <button className="btn-secondary" onClick={addWorkstream}><Plus size={14} /></button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'Work' && (
        <div className="card">
          <div className="card-title"><ListTodo size={18} style={{ marginRight: '0.4rem' }} />Tasks ({tasks.length})</div>
          <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '1rem' }}>
            <input className="input-field" placeholder="Quick add task..." value={newTaskTitle} onChange={(e) => setNewTaskTitle(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addTask()} />
            <button className="btn-capture" onClick={addTask}><Plus size={14} /></button>
          </div>
          <div className="entity-list">
            {tasks.map((t: any) => (
              <div key={t.id} className="entity-card" style={{ cursor: 'default' }}>
                <div className="entity-card-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span onClick={() => toggleTaskStatus(t)} style={{ cursor: 'pointer' }}>
                      {t.status === 'done' ? <CheckSquare size={16} color="var(--success)" /> : <Square size={16} />}
                    </span>
                    <Link href={`/tasks/${t.id}`} style={{ textDecoration: 'none' }}>
                      <h4 className="entity-card-title" style={{ textDecoration: t.status === 'done' ? 'line-through' : 'none' }}>{t.title}</h4>
                    </Link>
                  </div>
                  <span className={`badge badge-${t.priority === 'critical' || t.priority === 'high' ? 'red' : t.priority === 'medium' ? 'amber' : 'green'}`}>{t.priority}</span>
                </div>
                <div className="entity-card-meta">
                  <span className="meta-item">{t.status}</span>
                  {t.due_date && <span className="meta-item">Due {t.due_date}</span>}
                  <span className="meta-item">{t.owner}</span>
                </div>
              </div>
            ))}
            {tasks.length === 0 && <div className="empty-description" style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No tasks yet.</div>}
          </div>
        </div>
      )}

      {activeTab === 'Follow-ups' && (
        <div className="card">
          <div className="card-title"><MessageSquare size={18} style={{ marginRight: '0.4rem' }} />Follow-ups ({followups.length})</div>
          <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '1rem' }}>
            <input className="input-field" placeholder="Follow-up title" value={newFollowupTitle} onChange={(e) => setNewFollowupTitle(e.target.value)} />
            <input className="input-field" placeholder="Waiting on..." style={{ flex: '0 0 160px' }} value={newFollowupPerson} onChange={(e) => setNewFollowupPerson(e.target.value)} />
            <button className="btn-capture" onClick={addFollowup}><Plus size={14} /></button>
          </div>
          <div className="entity-list">
            {followups.map((f: any) => (
              <div key={f.id} className="entity-card" style={{ opacity: f.status === 'resolved' ? 0.6 : 1 }}>
                <div className="entity-card-header">
                  <h4 className="entity-card-title">{f.waiting_on_person} — {f.title}</h4>
                  <span className="badge">{f.status}</span>
                </div>
                <div className="entity-card-meta">
                  {f.status === 'waiting' && <span className="waiting-pill aging">{f.waiting_days}d waiting</span>}
                  {f.expected_date && <span className="meta-item">Expected {f.expected_date}</span>}
                  {f.status !== 'resolved' && (
                    <button className="btn-secondary" style={{ marginLeft: 'auto', padding: '0.2rem 0.6rem', fontSize: '0.75rem' }} onClick={() => resolveFollowup(f.id)}>
                      Mark resolved
                    </button>
                  )}
                </div>
              </div>
            ))}
            {followups.length === 0 && <div className="empty-description" style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No follow-ups yet.</div>}
          </div>
        </div>
      )}

      {activeTab === 'QC' && (
        <div className="card">
          <div className="card-title"><ClipboardCheck size={18} style={{ marginRight: '0.4rem' }} />Project QC</div>
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
            <select className="form-select" value={selectedTemplateId} onChange={(e) => setSelectedTemplateId(e.target.value)} style={{ maxWidth: '320px' }}>
              <option value="">Select a template</option>
              {availableTemplates.map((template: any) => <option key={template.id} value={template.id}>{template.title}</option>)}
            </select>
            <select className="form-select" aria-label="Checklist scope" value={qcTargetType} onChange={(e) => { setQcTargetType(e.target.value as 'project' | 'task' | 'deliverable'); setQcTargetId(''); }} style={{ maxWidth: '175px' }}>
              <option value="project">Project</option><option value="task">Task</option><option value="deliverable">Deliverable</option>
            </select>
            {qcTargetType !== 'project' && <select className="form-select" aria-label={`Select ${qcTargetType}`} value={qcTargetId} onChange={(e) => setQcTargetId(e.target.value)} style={{ maxWidth: '260px' }}>
              <option value="">Select {qcTargetType}</option>
              {(qcTargetType === 'task' ? tasks : deliverables).map((item: any) => <option key={item.id} value={item.id}>{item.title}</option>)}
            </select>}
            <button type="button" className="btn-capture" onClick={attachChecklist} disabled={!selectedTemplateId || (qcTargetType !== 'project' && !qcTargetId)}><Plus size={14} /> Attach checklist</button>
            <Link href="/qc" className="btn-secondary" style={{ textDecoration: 'none' }}>Manage templates</Link>
          </div>
          {qcError && <p role="alert" style={{ color: 'var(--danger)' }}>{qcError}</p>}
          {qcChecklists.map((checklist: any) => {
            const total = checklist.items.length;
            const done = checklist.items.filter((item: any) => item.is_checked).length;
            return (
              <div key={checklist.id} style={{ marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <h4 style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{checklist.title}</h4>
                  {(checklist.task_id || checklist.deliverable_id) && <span className="badge">{checklist.task_id ? tasks.find((task: any) => task.id === checklist.task_id)?.title : deliverables.find((item: any) => item.id === checklist.deliverable_id)?.title}</span>}
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{done}/{total}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  {checklist.items.map((item: any) => (
                    <button type="button"
                      key={item.id}
                      onClick={() => toggleQcItem(item)}
                      aria-pressed={!!item.is_checked}
                      style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem', color: item.is_checked ? 'var(--text-muted)' : 'var(--text-primary)', textDecoration: item.is_checked ? 'line-through' : 'none', border: 0, background: 'none', textAlign: 'left' }}
                    >
                      {item.is_checked ? <CheckSquare size={16} color="var(--success)" /> : <Square size={16} />}
                      <span>{item.title}</span>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
          {qcChecklists.length === 0 && (
            <div className="empty-description" style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No checklists yet. Attach a template to start tracking QC for this project.</div>
          )}
        </div>
      )}

      {activeTab === 'Notes' && (
        <div className="card">
          <div className="card-title"><FileText size={18} style={{ marginRight: '0.4rem' }} />Notes ({notes.length})</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
            <input className="input-field" placeholder="Note title" value={newNoteTitle} onChange={(e) => setNewNoteTitle(e.target.value)} />
            <textarea className="input-field" placeholder="Note content" style={{ height: '70px' }} value={newNoteContent} onChange={(e) => setNewNoteContent(e.target.value)} />
            <button className="btn-secondary" onClick={addNote} style={{ alignSelf: 'flex-end' }}><Plus size={14} /> Add note</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {notes.map((n: any) => (
              <div key={n.id} style={{ padding: '0.75rem', background: 'var(--bg-card)', borderRadius: 'var(--radius-md)' }}>
                <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.9rem' }}>{n.title}</div>
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', whiteSpace: 'pre-wrap' }}>{n.content}</div>
              </div>
            ))}
            {notes.length === 0 && <div className="empty-description" style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No notes linked to this project yet.</div>}
          </div>
        </div>
      )}

      {activeTab === 'Calendar' && (
        <div className="card">
          <div className="card-title"><CalendarIcon size={18} style={{ marginRight: '0.4rem' }} />Related Events</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {events.map((e: any) => (
              <div key={e.id} style={{ padding: '0.75rem', background: 'var(--bg-card)', borderRadius: 'var(--radius-md)', display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{e.title}</span>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{new Date(e.start_time).toLocaleString()}</span>
              </div>
            ))}
            {events.length === 0 && <div className="empty-description" style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No calendar events linked to this project.</div>}
          </div>
        </div>
      )}

      {activeTab === 'Activity' && (
        <div className="card">
          <div className="card-title"><ActivityIcon size={18} style={{ marginRight: '0.4rem' }} />Activity History</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {activity.map((a: any) => (
              <div key={a.id} style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', paddingBottom: '0.6rem', borderBottom: '1px solid var(--border-subtle)' }}>
                <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{a.action}</span> — {a.details}
                <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{new Date(a.created_at).toLocaleString()}</div>
              </div>
            ))}
            {activity.length === 0 && <div className="empty-description" style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No activity recorded yet.</div>}
          </div>
        </div>
      )}
    </div>
  );
}
