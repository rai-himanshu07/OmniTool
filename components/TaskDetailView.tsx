'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Pencil, Trash2, Plus, CheckSquare, Square, X, Link2, ListTodo, Activity as ActivityIcon, MessageSquare, Target } from 'lucide-react';
import { format } from 'date-fns';
import { Person, Project } from '@/lib/db/schema';

interface Props {
  taskId: string;
}

export default function TaskDetailView({ taskId }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [task, setTask] = useState<any>(null);
  const [allTasks, setAllTasks] = useState<any[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [people, setPeople] = useState<Person[]>([]);

  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<any>({});

  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [dependsOnId, setDependsOnId] = useState('');
  const [focusFeedback, setFocusFeedback] = useState('');

  const fetchTask = useCallback(async () => {
    try {
      const res = await fetch(`/api/tasks/${taskId}`);
      if (!res.ok) {
        setTask(null);
        return;
      }
      const data = await res.json();
      setTask(data.task);
      setEditForm({
        title: data.task.title,
        description: data.task.description || '',
        owner: data.task.owner,
        assignee_person_id: data.task.assignee_person_id || undefined,
        status: data.task.status,
        priority: data.task.priority,
        due_date: data.task.due_date || '',
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    fetchTask();
    fetch('/api/tasks').then((r) => r.json()).then((d) => setAllTasks(d.tasks || [])).catch(console.error);
    fetch('/api/projects').then((r) => r.json()).then((d) => setProjects(d.projects || [])).catch(console.error);
    fetch('/api/people').then((r) => r.json()).then((d) => setPeople(d.people || [])).catch(console.error);
  }, [fetchTask]);

  const handleSaveEdit = async () => {
    await fetch(`/api/tasks/${taskId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editForm),
    });
    setEditing(false);
    fetchTask();
  };

  const addToFocus = async () => {
    try {
      const response = await fetch('/api/focus', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: format(new Date(), 'yyyy-MM-dd'), entity_type: 'task', entity_id: taskId }) });
      const result = await response.json();
      setFocusFeedback(response.ok ? 'Added to today’s Focus Plan.' : result.error || 'Could not add to focus.');
    } catch { setFocusFeedback('Could not add to focus.'); }
  };

  const handleDeleteTask = async () => {
    if (!confirm(`Delete "${task.title}"? This cannot be undone.`)) return;
    await fetch(`/api/tasks/${taskId}`, { method: 'DELETE' });
    router.push('/my-work');
  };

  const toggleStatus = async () => {
    const newStatus = task.status === 'done' ? 'open' : 'done';
    await fetch(`/api/tasks/${taskId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    });
    fetchTask();
  };

  const addSubtask = async () => {
    if (!newSubtaskTitle.trim()) return;
    await fetch(`/api/tasks/${taskId}/subtasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: newSubtaskTitle.trim() }),
    });
    setNewSubtaskTitle('');
    fetchTask();
  };

  const toggleSubtask = async (subtask: any) => {
    await fetch(`/api/tasks/${taskId}/subtasks`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subtask_id: subtask.id, status: subtask.status === 'done' ? 'open' : 'done' }),
    });
    fetchTask();
  };

  const deleteSubtask = async (subtaskId: string) => {
    await fetch(`/api/tasks/${taskId}/subtasks?subtask_id=${subtaskId}`, { method: 'DELETE' });
    fetchTask();
  };

  const addDependency = async () => {
    if (!dependsOnId) return;
    await fetch(`/api/tasks/${taskId}/dependencies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ depends_on_task_id: dependsOnId }),
    });
    setDependsOnId('');
    fetchTask();
  };

  const removeDependency = async (dependencyId: string) => {
    await fetch(`/api/tasks/${taskId}/dependencies?dependency_id=${dependencyId}`, { method: 'DELETE' });
    fetchTask();
  };

  const resolveFollowup = async (id: string) => {
    await fetch('/api/followups', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status: 'resolved' }),
    });
    fetchTask();
  };

  if (loading) {
    return <div style={{ color: 'var(--text-muted)', padding: '2rem' }}>Loading task...</div>;
  }

  if (!task) {
    return (
      <div style={{ padding: '2rem' }}>
        <p style={{ color: 'var(--text-muted)' }}>Task not found.</p>
        <button className="btn-secondary" onClick={() => router.push('/my-work')} style={{ marginTop: '1rem' }}>
          <ArrowLeft size={14} /> Back to My Work
        </button>
      </div>
    );
  }

  const priorityBadge = task.priority === 'critical' || task.priority === 'high' ? 'red' : task.priority === 'medium' ? 'amber' : 'green';
  const otherTasks = allTasks.filter((t) => t.id !== taskId && !(task.dependencies || []).some((d: any) => d.depends_on_task_id === t.id));

  return (
    <div>
      <button
        onClick={() => router.back()}
        style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', marginBottom: '1rem', fontSize: '0.85rem', padding: 0 }}
      >
        <ArrowLeft size={14} /> Back
      </button>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', gap: '1rem', flexWrap: 'wrap' }}>
        <div>
          {task.project_name && <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>{task.project_name}</div>}
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <span onClick={toggleStatus} style={{ cursor: 'pointer' }}>
              {task.status === 'done' ? <CheckSquare size={26} color="var(--success)" /> : <Square size={26} />}
            </span>
            <span style={{ textDecoration: task.status === 'done' ? 'line-through' : 'none' }}>{task.title}</span>
            <span className={`badge badge-${priorityBadge}`}>{task.priority}</span>
            <span className="badge">{task.status}</span>
          </h1>
          {task.description && !editing && <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.35rem', maxWidth: '640px' }}>{task.description}</p>}
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn-secondary" onClick={addToFocus} disabled={task.status === 'done' || task.status === 'cancelled'} title="Add to today's Focus Plan" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}><Target size={14} /> Focus</button>
          <button className="btn-secondary" onClick={() => setEditing(!editing)} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <Pencil size={14} /> {editing ? 'Cancel' : 'Edit'}
          </button>
          <button className="btn-secondary" onClick={handleDeleteTask} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--danger)' }}>
            <Trash2 size={14} /> Delete
          </button>
        </div>
      </div>

      {focusFeedback && <p role="status" className="work-muted">{focusFeedback} <Link href="/#focus-plan">View plan</Link></p>}

      {editing && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <div className="card-title">Edit Task</div>
          <div className="task-edit-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
            <input className="input-field" value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} placeholder="Title" />
            <select className="input-field" aria-label="Assigned person" value={editForm.assignee_person_id || ''} onChange={(e) => { const person = people.find((entry) => entry.id === e.target.value); setEditForm({ ...editForm, assignee_person_id: e.target.value || null, owner: person?.name || 'Unassigned' }); }}>
              <option value="">No linked assignee</option>
              {people.filter((person) => person.active || person.id === task.assignee_person_id).map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
            </select>
            <input className="input-field" aria-label="Owner text" value={editForm.owner} onChange={(e) => setEditForm({ ...editForm, owner: e.target.value, assignee_person_id: undefined })} placeholder="Owner text for unlinked work" disabled={!!editForm.assignee_person_id} />
            <select className="input-field" value={editForm.status} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}>
              <option value="inbox">Inbox</option>
              <option value="open">Open</option>
              <option value="in_progress">In Progress</option>
              <option value="blocked">Blocked</option>
              <option value="waiting">Waiting</option>
              <option value="done">Done</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <select className="input-field" value={editForm.priority} onChange={(e) => setEditForm({ ...editForm, priority: e.target.value })}>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
            <input type="date" className="input-field" value={editForm.due_date} onChange={(e) => setEditForm({ ...editForm, due_date: e.target.value })} />
          </div>
          <textarea
            className="input-field"
            value={editForm.description}
            onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
            style={{ height: '90px', marginBottom: '1rem' }}
            placeholder="Description"
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button className="btn-capture" onClick={handleSaveEdit}>Save changes</button>
          </div>
        </div>
      )}

      <div className="task-detail-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
        <div className="card">
          <div className="card-title"><ListTodo size={18} style={{ marginRight: '0.4rem' }} />Subtasks ({(task.subtasks || []).length})</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '1rem' }}>
            {(task.subtasks || []).map((s: any) => (
              <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
                <span onClick={() => toggleSubtask(s)} style={{ cursor: 'pointer', display: 'flex' }}>
                  {s.status === 'done' ? <CheckSquare size={16} color="var(--success)" /> : <Square size={16} />}
                </span>
                <span style={{ flex: 1, color: s.status === 'done' ? 'var(--text-muted)' : 'var(--text-primary)', textDecoration: s.status === 'done' ? 'line-through' : 'none' }}>{s.title}</span>
                <X size={13} style={{ cursor: 'pointer', color: 'var(--text-muted)' }} onClick={() => deleteSubtask(s.id)} />
              </div>
            ))}
            {(task.subtasks || []).length === 0 && <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No subtasks yet</span>}
          </div>
          <div style={{ display: 'flex', gap: '0.4rem' }}>
            <input className="input-field" placeholder="New subtask" value={newSubtaskTitle} onChange={(e) => setNewSubtaskTitle(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addSubtask()} />
            <button className="btn-secondary" onClick={addSubtask}><Plus size={14} /></button>
          </div>
        </div>

        <div className="card">
          <div className="card-title"><Link2 size={18} style={{ marginRight: '0.4rem' }} />Dependencies</div>
          <div style={{ marginBottom: '1rem' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700, marginBottom: '0.4rem' }}>Blocked by</div>
            {(task.dependencies || []).length === 0 && <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Nothing blocking this task</span>}
            {(task.dependencies || []).map((d: any) => (
              <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', marginBottom: '0.3rem' }}>
                <span className={`badge ${d.depends_on_status === 'done' ? 'badge-green' : ''}`}>{d.depends_on_status}</span>
                <span style={{ flex: 1, color: 'var(--text-primary)' }}>{d.depends_on_title}</span>
                <X size={13} style={{ cursor: 'pointer', color: 'var(--text-muted)' }} onClick={() => removeDependency(d.id)} />
              </div>
            ))}
          </div>
          {(task.dependents || []).length > 0 && (
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700, marginBottom: '0.4rem' }}>Blocks</div>
              {(task.dependents || []).map((d: any) => (
                <div key={d.id} style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>{d.task_title}</div>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', gap: '0.4rem' }}>
            <select className="input-field" value={dependsOnId} onChange={(e) => setDependsOnId(e.target.value)}>
              <option value="">Add dependency on...</option>
              {otherTasks.map((t) => (
                <option key={t.id} value={t.id}>{t.title}</option>
              ))}
            </select>
            <button className="btn-secondary" onClick={addDependency} disabled={!dependsOnId}><Plus size={14} /></button>
          </div>
        </div>

        <div className="card">
          <div className="card-title"><MessageSquare size={18} style={{ marginRight: '0.4rem' }} />Linked Follow-ups</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {(task.followups || []).map((f: any) => (
              <div key={f.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem' }}>
                <span style={{ color: 'var(--text-primary)' }}>{f.waiting_on_person} — {f.title}</span>
                {f.status !== 'resolved' ? (
                  <button className="btn-secondary" style={{ padding: '0.15rem 0.5rem', fontSize: '0.7rem' }} onClick={() => resolveFollowup(f.id)}>Resolve</button>
                ) : (
                  <span className="badge badge-green">resolved</span>
                )}
              </div>
            ))}
            {(task.followups || []).length === 0 && <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No follow-ups linked to this task.</span>}
          </div>
        </div>

        <div className="card">
          <div className="card-title"><ActivityIcon size={18} style={{ marginRight: '0.4rem' }} />Activity</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {(task.activity || []).map((a: any) => (
              <div key={a.id} style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{a.action}</span> — {a.details}
                <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>{new Date(a.created_at).toLocaleString()}</div>
              </div>
            ))}
            {(task.activity || []).length === 0 && <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No activity recorded yet.</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
