'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search,
  X,
  CheckSquare,
  FolderKanban,
  Clock,
  FileText,
  Inbox,
  ArrowRight,
  CornerDownLeft
} from 'lucide-react';

interface SearchResult {
  entity_type: string;
  entity_id: string;
  title: string;
  snippet?: string;
  project_name?: string;
}

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const TYPE_META: Record<string, { icon: typeof Search; label: string; route: string }> = {
  task: { icon: CheckSquare, label: 'Task', route: '/my-work' },
  project: { icon: FolderKanban, label: 'Project', route: '/projects' },
  followup: { icon: Clock, label: 'Follow-up', route: '/followups' },
  note: { icon: FileText, label: 'Note', route: '/notes' },
  inbox: { icon: Inbox, label: 'Inbox', route: '/inbox' },
};

export default function SearchModal({ isOpen, onClose }: SearchModalProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [focusIndex, setFocusIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setResults([]);
      setFocusIndex(-1);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q.trim())}`);
      const data = await res.json();
      setResults(data.results || []);
      setFocusIndex(-1);
    } catch { setResults([]); }
    finally { setLoading(false); }
  }, []);

  const handleQueryChange = (val: string) => {
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(val), 300);
  };

  const navigateToResult = (result: SearchResult) => {
    const meta = TYPE_META[result.entity_type];
    if (meta) {
      router.push(meta.route);
    }
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { onClose(); return; }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusIndex(i => Math.min(i + 1, results.length - 1));
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusIndex(i => Math.max(i - 1, 0));
    }
    if (e.key === 'Enter' && focusIndex >= 0 && focusIndex < results.length) {
      e.preventDefault();
      navigateToResult(results[focusIndex]);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="search-modal-overlay" onClick={onClose}>
      <div className="search-modal" onClick={e => e.stopPropagation()} onKeyDown={handleKeyDown}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem', borderBottom: '1px solid var(--border)' }}>
          <Search size={18} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          <input
            ref={inputRef}
            className="search-modal-input"
            placeholder="Search tasks, projects, follow-ups, notes..."
            value={query}
            onChange={e => handleQueryChange(e.target.value)}
            style={{ border: 'none', padding: 0 }}
          />
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', flexShrink: 0 }}>
            <X size={18} />
          </button>
        </div>

        <div className="search-results">
          {loading && (
            <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              Searching...
            </div>
          )}

          {!loading && query && results.length === 0 && (
            <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              No results for &ldquo;{query}&rdquo;
            </div>
          )}

          {!loading && !query && (
            <div style={{ padding: '1.5rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              <div style={{ marginBottom: '0.75rem', fontWeight: 600 }}>Search Hints</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div>Type to search across all tasks, projects, follow-ups, and notes</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span className="kbd">↑</span><span className="kbd">↓</span> Navigate
                  <span className="kbd" style={{ marginLeft: '0.5rem' }}>↵</span> Open
                  <span className="kbd" style={{ marginLeft: '0.5rem' }}>Esc</span> Close
                </div>
              </div>
            </div>
          )}

          {results.map((result, idx) => {
            const meta = TYPE_META[result.entity_type] || { icon: FileText, label: result.entity_type, route: '/' };
            const Icon = meta.icon;
            return (
              <div
                key={`${result.entity_type}-${result.entity_id}`}
                className={`search-result-item ${idx === focusIndex ? 'focused' : ''}`}
                onClick={() => navigateToResult(result)}
                onMouseEnter={() => setFocusIndex(idx)}
              >
                <Icon size={16} style={{ color: 'var(--accent-secondary)', flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="search-result-title">{result.title}</div>
                  {result.snippet && (
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.15rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {result.snippet}
                    </div>
                  )}
                </div>
                <span className="search-result-type">{meta.label}</span>
                {result.project_name && (
                  <span className="search-result-context">{result.project_name}</span>
                )}
                {idx === focusIndex && <CornerDownLeft size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
