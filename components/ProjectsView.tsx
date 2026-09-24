'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { FolderKanban, Plus, Layers, User, Calendar, AlertCircle } from 'lucide-react';
import { Project, Client, Person } from '@/lib/db/schema';

export default function ProjectsView() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddProject, setShowAddProject] = useState(false);
  const [showAddClient, setShowAddClient] = useState(false);
  const [clientName, setClientName] = useState('');
  const [clientCode, setClientCode] = useState('');
  const [clientError, setClientError] = useState('');

  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [clientId, setClientId] = useState('');
  const [ownerPersonId, setOwnerPersonId] = useState('');
  const [description, setDescription] = useState('');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [priority, setPriority] = useState<'critical' | 'high' | 'medium' | 'low'>('medium');

  const fetchData = async () => {
    setLoading(true);
    try {
      const [projRes, clientRes, peopleRes] = await Promise.all([fetch('/api/projects'), fetch('/api/clients'), fetch('/api/people')]);
      const projData = await projRes.json();
      const clientData = await clientRes.json();
      setProjects(projData.projects || []);
      setClients(clientData.clients || []);
      setPeople((await peopleRes.json()).people || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          code: code.trim() || undefined,
          client_id: clientId || undefined,
          owner_person_id: ownerPersonId || undefined,
          description: description.trim() || undefined,
          planned_delivery_date: deliveryDate || undefined,
          priority
        })
      });
      setName('');
      setCode('');
      setOwnerPersonId('');
      setDescription('');
      setShowAddProject(false);
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName.trim()) return;
    try {
      const response = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: clientName.trim(), code: clientCode.trim() }),
      });
      if (!response.ok) throw new Error('Client creation failed');
      const { client } = await response.json();
      setClients((current) => [...current, client].sort((a, b) => a.name.localeCompare(b.name)));
      setClientId(client.id);
      setClientName('');
      setClientCode('');
      setClientError('');
      setShowAddClient(false);
    } catch { setClientError('Could not save client. Please try again.'); }
  };

  return (
    <div>
      <div className="page-actions-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-primary)' }}>Projects & Clients</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Client workspace hierarchy and project health indicators
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn-secondary" onClick={() => setShowAddClient(!showAddClient)}><Plus size={16} /> New Client</button>
          <button className="btn-capture" onClick={() => setShowAddProject(!showAddProject)}><Plus size={18} /> New Project</button>
        </div>
      </div>

      {showAddClient && (
        <form className="inline-form" onSubmit={handleCreateClient} style={{ marginBottom: '1rem' }}>
          <div className="form-row">
            <div className="form-group"><label className="form-label">Client name</label><input className="form-input" value={clientName} onChange={(e) => setClientName(e.target.value)} required /></div>
            <div className="form-group"><label className="form-label">Code (optional)</label><input className="form-input" value={clientCode} onChange={(e) => setClientCode(e.target.value)} /></div>
          </div>
          {clientError && <p role="alert" className="work-error">{clientError}</p>}
          <div className="form-actions"><button type="button" className="btn-secondary" onClick={() => setShowAddClient(false)}>Cancel</button><button type="submit" className="btn-capture">Save client</button></div>
        </form>
      )}

      {showAddProject && (
        <form className="card" onSubmit={handleCreateProject} style={{ marginBottom: '1.5rem' }}>
          <div className="card-title">Create New Project</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
            <input
              type="text"
              className="input-field"
              placeholder="Project Name (e.g. P&ID Extraction)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
            <input
              type="text"
              className="input-field"
              placeholder="Project Code (e.g. PID-01)"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
            <select className="input-field" value={clientId} onChange={(e) => setClientId(e.target.value)}>
              <option value="">Select Client (Optional)</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.code || 'N/A'})
                </option>
              ))}
            </select>
            <select className="input-field" aria-label="Project owner" value={ownerPersonId} onChange={(e) => setOwnerPersonId(e.target.value)}><option value="">Personal owner</option>{people.filter((person) => person.active).map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select>
            <button type="button" className="btn-secondary" onClick={() => setShowAddClient(true)}><Plus size={14} /> New client</button>
            <input
              type="date"
              className="input-field"
              value={deliveryDate}
              onChange={(e) => setDeliveryDate(e.target.value)}
            />
          </div>
          <textarea
            className="input-field"
            placeholder="Objective & Scope description..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            style={{ marginBottom: '1rem', height: '80px' }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <button type="button" className="btn-secondary" onClick={() => setShowAddProject(false)}>
              Cancel
            </button>
            <button type="submit" className="btn-capture">
              Create Project
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div style={{ color: 'var(--text-muted)' }}>Loading projects...</div>
      ) : (
        <div className="project-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 340px), 1fr))', gap: '1.5rem' }}>
          {projects.map((proj) => (
            <div
              key={proj.id}
              className="card"
              onClick={() => router.push(`/projects/${proj.id}`)}
              style={{ display: 'flex', flexDirection: 'column', height: '100%', cursor: 'pointer' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                <div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                    {proj.client_name || 'Internal'}
                  </div>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)' }}>{proj.name}</h3>
                </div>
                <span className={`badge badge-${proj.status === 'red' ? 'red' : proj.status === 'amber' ? 'amber' : 'green'}`}>
                  {proj.status.toUpperCase()}
                </span>
              </div>

              {proj.description && (
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem', flex: 1 }}>
                  {proj.description}
                </p>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', background: 'var(--bg-card)', padding: '0.75rem', borderRadius: 'var(--radius-md)', fontSize: '0.8rem', marginBottom: '1rem' }}>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Total Tasks: </span>
                  <span style={{ fontWeight: 600 }}>{proj.tasks_count || 0}</span>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Overdue: </span>
                  <span style={{ fontWeight: 600, color: proj.overdue_tasks_count ? 'var(--rose)' : 'inherit' }}>
                    {proj.overdue_tasks_count || 0}
                  </span>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Follow-ups: </span>
                  <span style={{ fontWeight: 600, color: 'var(--amber)' }}>{proj.open_followups_count || 0}</span>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Delivery: </span>
                  <span style={{ fontWeight: 600 }}>{proj.planned_delivery_date || 'TBD'}</span>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: 'var(--text-muted)', paddingTop: '0.5rem', borderTop: '1px solid var(--border-subtle)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <User size={14} />
                  <span>Owner: {proj.owner}</span>
                </div>
                <span>Code: {proj.code || 'N/A'}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
