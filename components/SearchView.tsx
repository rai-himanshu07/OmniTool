'use client';

import React, { useState, useEffect } from 'react';
import { Search, CheckSquare, FolderKanban, Clock, FileText, Inbox, BookOpen } from 'lucide-react';
import Link from 'next/link';

interface SearchResult {
  entity_type: string;
  entity_id: string;
  href: string;
  title: string;
  snippet?: string;
  project_name?: string;
}

const TYPE_FILTERS = [
  { value: '', label: 'All', icon: Search },
  { value: 'task', label: 'Tasks', icon: CheckSquare },
  { value: 'project', label: 'Projects', icon: FolderKanban },
  { value: 'followup', label: 'Follow-ups', icon: Clock },
  { value: 'note', label: 'Notes', icon: FileText },
  { value: 'inbox', label: 'Inbox', icon: Inbox },
  { value: 'notebook', label: 'Notebook pages', icon: BookOpen },
];

export default function SearchView() {
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [filters, setFilters] = useState({ project_id: '', client_id: '', person_id: '', priority: '', status: '' });
  const [options, setOptions] = useState<any>({ projects: [], clients: [], people: [] });
  const [error, setError] = useState('');
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  useEffect(() => { Promise.all([fetch('/api/projects').then((response) => response.json()), fetch('/api/clients').then((response) => response.json()), fetch('/api/people').then((response) => response.json())]).then(([projects, clients, people]) => setOptions({ projects: projects.projects || [], clients: clients.clients || [], people: people.people || [] })).catch(() => setError('Could not load search filters')); }, []);

  const doSearch = async () => {
    if (!query.trim() && !Object.values(filters).some(Boolean)) return;
    setLoading(true);
    setSearched(true);
    try {
      const params = new URLSearchParams({ q: query.trim(), ...filters, offset: String(offset) });
      if (typeFilter) params.set('type', typeFilter);
      const res = await fetch(`/api/search?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Search failed');
      setResults(data.results || []);
      setHasMore(!!data.has_more); setError('');
    } catch (cause) { setError(String(cause)); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      if (query.trim() || Object.values(filters).some(Boolean)) doSearch();
      else { setResults([]); setSearched(false); }
    }, 300);
    return () => clearTimeout(timer);
  }, [query, typeFilter, filters, offset]);

  const getEntityRoute = (type: string) => {
    const routes: Record<string, string> = {
      task: '/my-work', project: '/projects', followup: '/followups',
      note: '/notes', inbox: '/inbox'
    };
    return routes[type] || '/';
  };

  const getEntityIcon = (type: string) => {
    const icons: Record<string, typeof Search> = {
      task: CheckSquare, project: FolderKanban, followup: Clock,
      note: FileText, inbox: Inbox, notebook: BookOpen
    };
    return icons[type] || Search;
  };

  return (
    <div>
      <div className="page-header">
        <h1>Search</h1>
        <p>Find anything across tasks, projects, follow-ups, and notes</p>
      </div>

      {/* Search Input */}
      <div className="card" style={{ marginBottom: '1rem', padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <Search size={18} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
        <input
          type="text"
          className="form-input"
          placeholder="Search everything..."
          value={query}
          onChange={e => { setOffset(0); setQuery(e.target.value); }}
          autoFocus
          style={{ flex: 1, background: 'transparent', border: 'none', fontSize: '1rem', margin: 0 }}
        />
      </div>

      {/* Type Filters */}
      <div className="file-toolbar">{(['project_id', 'client_id', 'person_id'] as const).map((key) => <label key={key}>{key.replace('_id', '')}<select className="form-select" value={filters[key]} onChange={(event) => { setOffset(0); setFilters({ ...filters, [key]: event.target.value }); }}><option value="">All</option>{options[key === 'project_id' ? 'projects' : key === 'client_id' ? 'clients' : 'people'].map((entry: any) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</select></label>)}<label>Status<select className="form-select" value={filters.status} onChange={(event) => { setOffset(0); setFilters({ ...filters, status: event.target.value }); }}><option value="">All</option>{['open', 'in_progress', 'waiting', 'blocked', 'escalated', 'done', 'resolved'].map((value) => <option key={value}>{value}</option>)}</select></label><label>Priority<select className="form-select" value={filters.priority} onChange={(event) => { setOffset(0); setFilters({ ...filters, priority: event.target.value }); }}><option value="">All</option>{['critical', 'high', 'medium', 'low'].map((value) => <option key={value}>{value}</option>)}</select></label></div>
      {error && <p role="alert" className="work-error">{error}</p>}
      <div className="tabs" style={{ marginBottom: '1.5rem' }}>
        {TYPE_FILTERS.map(f => {
          const Icon = f.icon;
          return (
            <button
              key={f.value}
              className={`tab ${typeFilter === f.value ? 'active' : ''}`}
              onClick={() => { setOffset(0); setTypeFilter(f.value); }}
            >
              <Icon size={14} style={{ marginRight: '0.3rem' }} />
              {f.label}
            </button>
          );
        })}
      </div>

      {/* Results */}
      {loading && <div style={{ color: 'var(--text-muted)', padding: '2rem', textAlign: 'center' }}>Searching...</div>}

      {!loading && searched && results.length === 0 && (
        <div className="empty-state">
          <Search size={40} className="empty-icon" />
          <h3 className="empty-title">No results found</h3>
          <p className="empty-description">Try different keywords or remove filters</p>
        </div>
      )}

      {!loading && results.length > 0 && (
        <div className="entity-list">
          {results.map(result => {
            const Icon = getEntityIcon(result.entity_type);
            return (
              <Link
                key={`${result.entity_type}-${result.entity_id}`}
                href={result.href || getEntityRoute(result.entity_type)}
                className="entity-card"
                style={{ textDecoration: 'none' }}
              >
                <div className="entity-card-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Icon size={16} style={{ color: 'var(--accent-secondary)' }} />
                    <h4 className="entity-card-title">{result.title}</h4>
                  </div>
                  <span className="badge">{result.entity_type}</span>
                </div>
                {result.snippet && (
                  <div className="entity-card-meta">
                    <span>{result.snippet}</span>
                  </div>
                )}
                {result.project_name && (
                  <div className="entity-card-meta">
                    <span className="meta-item"><FolderKanban size={12} /> {result.project_name}</span>
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      )}

      {(offset > 0 || hasMore) && <div className="form-actions"><button className="btn-secondary" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - 100))}>Previous</button><button className="btn-secondary" disabled={!hasMore} onClick={() => setOffset(offset + 100)}>Next</button></div>}
      {!searched && !loading && (
        <div className="empty-state">
          <Search size={40} className="empty-icon" />
          <h3 className="empty-title">Start typing to search</h3>
          <p className="empty-description">Search across all your tasks, projects, follow-ups, notes, and inbox items</p>
          <div style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            Tip: Use <span className="kbd">⌘K</span> for quick search from anywhere
          </div>
        </div>
      )}
    </div>
  );
}
