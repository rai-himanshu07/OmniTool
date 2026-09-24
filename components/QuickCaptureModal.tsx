'use client';

import React, { useState, useEffect, useRef } from 'react';
import { X, Send, Inbox } from 'lucide-react';

interface QuickCaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function QuickCaptureModal({ isOpen, onClose, onSuccess }: QuickCaptureModalProps) {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setContent('');
      setError('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/inbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: content.trim(), source: 'quick_capture' })
      });
      if (res.ok) {
        onSuccess();
        onClose();
      } else {
        setError('Capture was not saved. Please try again.');
      }
    } catch (err) {
      console.error('Quick capture failed:', err);
      setError('Capture was not saved. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontWeight: 700, color: 'var(--text-primary)', fontSize: '1.1rem' }}>
            <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: 'var(--primary-gradient)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Inbox size={16} color="#fff" />
            </div>
            <span>Instant Capture</span>
          </div>
          <button onClick={onClose} aria-label="Close capture" style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', color: 'var(--text-secondary)', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ position: 'relative', marginBottom: '1.25rem' }}>
            <input
              ref={inputRef}
              type="text"
              className="input-field"
              placeholder="Capture any commitment, note, or follow-up... (e.g. 'Client ABC report by Friday')"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              disabled={loading}
              style={{ fontSize: '1.05rem', padding: '1rem 1.15rem' }}
            />
          </div>
          {error && <p role="alert" style={{ color: 'var(--danger)', marginBottom: '0.75rem' }}>{error}</p>}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              <span>Saved to Inbox • Triage anytime</span>
            </div>
            <button type="submit" className="btn-capture" disabled={loading || !content.trim()}>
              <Send size={16} />
              <span>{loading ? 'Saving...' : 'Capture'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
