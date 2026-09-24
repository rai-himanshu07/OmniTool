'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { Pencil, Plus, UserRound, UsersRound } from 'lucide-react';
import type { Person, Team } from '@/lib/db/schema';

type TeamDetail = Team & { members: { id: string; name: string; active: number; role: string }[]; projects: { id: string; name: string }[] };
type PersonDetail = Person & { team_count: number; project_count: number };

export default function TeamView() {
  const [people, setPeople] = useState<PersonDetail[]>([]);
  const [teams, setTeams] = useState<TeamDetail[]>([]);
  const [view, setView] = useState<'teams' | 'people'>('teams');
  const [showArchived, setShowArchived] = useState(false);
  const [editingPerson, setEditingPerson] = useState<string | null>(null);
  const [editingTeam, setEditingTeam] = useState<string | null>(null);
  const [formType, setFormType] = useState<'person' | 'team' | null>(null);
  const [personName, setPersonName] = useState('');
  const [personEmail, setPersonEmail] = useState('');
  const [personTitle, setPersonTitle] = useState('');
  const [teamName, setTeamName] = useState('');
  const [teamDescription, setTeamDescription] = useState('');
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [leadId, setLeadId] = useState('');
  const [error, setError] = useState('');

  const refresh = async () => {
    try {
      const [peopleResponse, teamsResponse] = await Promise.all([fetch('/api/people'), fetch('/api/teams')]);
      if (!peopleResponse.ok || !teamsResponse.ok) throw new Error('Could not load directory');
      setPeople((await peopleResponse.json()).people || []);
      setTeams((await teamsResponse.json()).teams || []);
    } catch { setError('Could not load the directory. Please refresh.'); }
  };
  useEffect(() => { refresh(); }, []);

  const closeForm = () => {
    setFormType(null); setEditingPerson(null); setEditingTeam(null); setError('');
    setPersonName(''); setPersonEmail(''); setPersonTitle('');
    setTeamName(''); setTeamDescription(''); setMemberIds([]); setLeadId('');
  };
  const editPerson = (person: PersonDetail) => {
    closeForm(); setView('people'); setEditingPerson(person.id); setFormType('person');
    setPersonName(person.name); setPersonEmail(person.email || ''); setPersonTitle(person.title || '');
  };
  const editTeam = (team: TeamDetail) => {
    closeForm(); setView('teams'); setEditingTeam(team.id); setFormType('team');
    setTeamName(team.name); setTeamDescription(team.description || '');
    setMemberIds(team.members.map((member) => member.id));
    setLeadId(team.members.find((member) => member.role === 'lead')?.id || '');
  };
  const savePerson = async (event: FormEvent) => {
    event.preventDefault();
    try {
      const response = await fetch('/api/people', { method: editingPerson ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...(editingPerson ? { id: editingPerson } : {}), name: personName.trim(), email: personEmail.trim(), title: personTitle.trim() }) });
      if (!response.ok) throw new Error((await response.json()).error || 'Could not save person');
      closeForm(); refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save person'); }
  };
  const saveTeam = async (event: FormEvent) => {
    event.preventDefault();
    try {
      const response = await fetch('/api/teams', { method: editingTeam ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...(editingTeam ? { id: editingTeam } : {}), name: teamName.trim(), description: teamDescription.trim(), member_ids: memberIds, lead_person_id: leadId || null }) });
      if (!response.ok) throw new Error((await response.json()).error || 'Could not save team');
      closeForm(); refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save team'); }
  };
  const toggleActive = async (kind: 'team' | 'person', id: string, active: number) => {
    const response = await fetch(kind === 'team' ? '/api/teams' : '/api/people', { method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, active: active ? 0 : 1 }) });
    if (response.ok) refresh(); else setError('Could not change status.');
  };

  return <div>
    <div className="page-header page-actions-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
      <div><h1>People &amp; Teams</h1><p>Project relationships and work ownership</p></div>
      <button className="btn-capture" onClick={() => { closeForm(); setFormType(view === 'people' ? 'person' : 'team'); }}><Plus size={16} /> New {view === 'people' ? 'person' : 'team'}</button>
    </div>
    <div className="tabs"><button className={`tab ${view === 'teams' ? 'active' : ''}`} onClick={() => { closeForm(); setView('teams'); }}>Teams</button><button className={`tab ${view === 'people' ? 'active' : ''}`} onClick={() => { closeForm(); setView('people'); }}>People</button></div>

    {formType === 'person' && <form className="inline-form" onSubmit={savePerson} style={{ marginBottom: '1rem' }}>
      <div className="form-row">
        <div className="form-group"><label className="form-label" htmlFor="person-name">Name</label><input id="person-name" className="form-input" required value={personName} onChange={(event) => setPersonName(event.target.value)} /></div>
        <div className="form-group"><label className="form-label" htmlFor="person-email">Email</label><input id="person-email" className="form-input" type="email" value={personEmail} onChange={(event) => setPersonEmail(event.target.value)} /></div>
        <div className="form-group"><label className="form-label" htmlFor="person-title">Role / title</label><input id="person-title" className="form-input" value={personTitle} onChange={(event) => setPersonTitle(event.target.value)} /></div>
      </div>
      {error && <p role="alert" className="work-error">{error}</p>}
      <div className="form-actions"><button type="button" className="btn-secondary" onClick={closeForm}>Cancel</button><button className="btn-capture" type="submit">Save person</button></div>
    </form>}

    {formType === 'team' && <form className="inline-form" onSubmit={saveTeam} style={{ marginBottom: '1rem' }}>
      <div className="form-row">
        <div className="form-group"><label className="form-label" htmlFor="team-name">Team name</label><input id="team-name" className="form-input" required value={teamName} onChange={(event) => setTeamName(event.target.value)} /></div>
        <div className="form-group"><label className="form-label" htmlFor="team-description">Purpose</label><input id="team-description" className="form-input" value={teamDescription} onChange={(event) => setTeamDescription(event.target.value)} /></div>
      </div>
      <fieldset className="team-members-picker"><legend>Members</legend>
        {people.filter((person) => person.active || memberIds.includes(person.id)).map((person) => <div className="team-member-option" key={person.id}>
          <label><input type="checkbox" checked={memberIds.includes(person.id)} onChange={(event) => { setMemberIds(event.target.checked ? [...memberIds, person.id] : memberIds.filter((id) => id !== person.id)); if (!event.target.checked && leadId === person.id) setLeadId(''); }} /> {person.name}</label>
          <label title="Team lead"><input type="radio" name="lead" checked={leadId === person.id} disabled={!memberIds.includes(person.id)} onChange={() => setLeadId(person.id)} /> Lead</label>
        </div>)}
        {!people.some((person) => person.active) && <p className="work-muted">Add a person in the People tab first.</p>}
      </fieldset>
      {error && <p role="alert" className="work-error">{error}</p>}
      <div className="form-actions"><button type="button" className="btn-secondary" onClick={closeForm}>Cancel</button><button className="btn-capture" type="submit">Save team</button></div>
    </form>}

    {!formType && error && <p role="alert" className="work-error">{error}</p>}
    <label className="directory-filter"><input type="checkbox" checked={showArchived} onChange={(event) => setShowArchived(event.target.checked)} /> Show archived</label>
    {view === 'people' ? people.filter((person) => showArchived || person.active).map((person) => <div className="work-row" key={person.id}>
      <UserRound size={17} aria-hidden="true" /><span className="work-row-content"><strong>{person.name}{person.active ? '' : ' · Archived'}</strong><small>{[person.title, person.email, `${person.team_count} teams`, `${person.project_count} direct projects`].filter(Boolean).join(' · ')}</small></span>
      <button type="button" className="btn-secondary" onClick={() => editPerson(person)} aria-label={`Edit ${person.name}`} title="Edit person"><Pencil size={15} /></button>
      <button type="button" className="btn-secondary" onClick={() => toggleActive('person', person.id, person.active)}>{person.active ? 'Archive' : 'Restore'}</button>
    </div>) : teams.filter((team) => showArchived || team.active).map((team) => <div className="work-row" key={team.id}>
      <UsersRound size={17} aria-hidden="true" /><span className="work-row-content"><strong>{team.name}{team.active ? '' : ' · Archived'}</strong><small>{team.description || `${team.members.length} members`} · {team.members.map((member) => member.role === 'lead' ? `${member.name} (lead)` : member.name).join(', ') || 'No members'}{team.projects.length > 0 && <> · {team.projects.map((project) => <Link key={project.id} href={`/projects/${project.id}`}>{project.name} </Link>)}</>}</small></span>
      <button type="button" className="btn-secondary" onClick={() => editTeam(team)} aria-label={`Edit ${team.name}`} title="Edit team"><Pencil size={15} /></button>
      <button type="button" className="btn-secondary" onClick={() => toggleActive('team', team.id, team.active)}>{team.active ? 'Archive' : 'Restore'}</button>
    </div>)}
  </div>;
}