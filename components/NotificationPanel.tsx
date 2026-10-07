'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, Check, CheckCheck, X, AlertTriangle, Clock, Calendar, RefreshCw, Inbox, BellRing } from 'lucide-react';
import Link from 'next/link';
import { requestJson } from '@/lib/client';

interface Notification {
  id: string;
  type: string; // 'overdue', 'due_soon', 'followup_aging', 'recurring_due', 'reminder'
  title: string;
  message: string;
  entity_type?: string;
  entity_id?: string;
  is_read: number;
  created_at: string;
}

export default function NotificationPanel() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [browserPermission, setBrowserPermission] = useState<NotificationPermission | 'unsupported'>('default');
  const panelRef = useRef<HTMLDivElement>(null);
  const seenIdsRef = useRef<Set<string> | null>(null);

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/notifications');
      const data = await res.json();
      const list: Notification[] = data.notifications || [];

      // Fire a native browser notification for unread items we haven't seen
      // yet (skip the very first load so a page refresh doesn't replay backlog).
      if (data.desktop_allowed && browserPermission === 'granted' && typeof window !== 'undefined' && 'Notification' in window) {
        if (seenIdsRef.current) {
          for (const n of list) {
            if (!n.is_read && !seenIdsRef.current.has(n.id)) {
              const alert = new window.Notification(n.title, { body: n.message, tag: n.id });
              alert.onclick = () => { window.focus(); openNotification(n); alert.close(); };
            }
          }
        }
      }
      seenIdsRef.current = new Set(list.map((n) => n.id));

      setNotifications(list);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setBrowserPermission(window.Notification.permission);
    } else {
      setBrowserPermission('unsupported');
    }
  }, []);

  const requestBrowserPermission = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    const result = await window.Notification.requestPermission();
    setBrowserPermission(result);
  };

  useEffect(() => {
    fetchNotifications();
    // Poll every 60 seconds
    const interval = setInterval(fetchNotifications, 60000);
    return () => clearInterval(interval);
  }, [browserPermission]);

  // Close on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isOpen]);

  const markAsRead = async (ids: string[]) => {
    try {
      const response = await fetch('/api/notifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids })
      });
      if (!response.ok) throw new Error('Could not mark notification read');
      setNotifications(prev => prev.map(n => ids.includes(n.id) ? { ...n, is_read: 1 } : n));
    } catch (err) { console.error(err); }
  };

  const markAllRead = async () => {
    try {
      await fetch('/api/notifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mark_all: true })
      });
      setNotifications(prev => prev.map(n => ({ ...n, is_read: 1 })));
    } catch (err) { console.error(err); }
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  async function openNotification(notification: Notification) {
    if (!notification.is_read) await markAsRead([notification.id]);
    const target = notification.entity_type === 'task' && notification.entity_id
      ? `/tasks/${notification.entity_id}`
      : notification.entity_type === 'project' && notification.entity_id
      ? `/projects/${notification.entity_id}`
      : notification.entity_type === 'followup' && notification.entity_id
      ? `/followups?focus=${notification.entity_id}`
      : notification.entity_type === 'meeting' ? '/calendar' : '/my-work';
    setIsOpen(false);
    router.push(target);
  }

  const getIcon = (type: string) => {
    switch (type) {
      case 'overdue': return <AlertTriangle size={14} style={{ color: 'var(--danger)' }} />;
      case 'due_soon': return <Clock size={14} style={{ color: 'var(--warning)' }} />;
      case 'followup_aging': return <RefreshCw size={14} style={{ color: 'var(--accent-primary)' }} />;
      case 'recurring_due': return <Calendar size={14} style={{ color: 'var(--accent-secondary)' }} />;
      case 'reminder': return <Bell size={14} style={{ color: 'var(--success)' }} />;
      default: return <Inbox size={14} style={{ color: 'var(--text-muted)' }} />;
    }
  };

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDay = Math.floor(diffHr / 24);
    return `${diffDay}d ago`;
  };

  return (
    <div ref={panelRef} style={{ position: 'relative' }}>
      {/* Bell Button */}
      <button
        onClick={() => { setIsOpen(!isOpen); if (!isOpen) fetchNotifications(); }}
        style={{
          position: 'relative', background: 'none', border: 'none',
          color: 'var(--text-secondary)', cursor: 'pointer', padding: '0.5rem',
          borderRadius: '8px', transition: 'all 0.15s ease'
        }}
        className="notification-trigger"
        aria-label="Notifications"
      >
        <Bell size={19} />
        {unreadCount > 0 && (
          <span className="notification-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div style={{
          position: 'absolute', top: '100%', right: 0,
          width: '340px', maxHeight: '480px',
          background: 'var(--bg-elevated)', border: '1px solid var(--border)',
          borderRadius: '12px', boxShadow: '0 15px 40px rgba(0,0,0,0.4)',
          zIndex: 50, overflow: 'hidden',
          animation: 'slideIn 0.2s ease'
        }}>
          {/* Header */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '0.75rem 1rem', borderBottom: '1px solid var(--border)'
          }}>
            <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>Notifications</span>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {unreadCount > 0 && (
                <button onClick={markAllRead} className="btn btn-sm btn-secondary" style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem' }}>
                  <CheckCheck size={12} /> Mark all read
                </button>
              )}
              <button onClick={() => setIsOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={16} />
              </button>
            </div>
          </div>

          {browserPermission === 'default' && (
            <button
              onClick={requestBrowserPermission}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: '0.5rem',
                padding: '0.6rem 1rem', background: 'rgba(10, 132, 255, 0.08)', border: 'none',
                borderBottom: '1px solid var(--border)', color: 'var(--accent-primary)', cursor: 'pointer',
                fontSize: '0.78rem', fontWeight: 600
              }}
            >
              <BellRing size={13} /> Enable desktop alerts for new notifications
            </button>
          )}

          {/* Notification List */}
          <div style={{ padding: '0.5rem 1rem', fontSize: '0.75rem' }}>Alerts require an open app. <Link href="/preferences">Preferences</Link></div>
          <div style={{ overflowY: 'auto', maxHeight: '400px' }}>
            {loading && notifications.length === 0 && (
              <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>Loading...</div>
            )}
            {!loading && notifications.length === 0 && (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                <Bell size={24} style={{ marginBottom: '0.5rem', opacity: 0.4 }} />
                <div>No notifications</div>
              </div>
            )}
            {notifications.map(n => (
              <div
                key={n.id}
                onClick={() => openNotification(n)}
                role="link"
                tabIndex={0}
                onKeyDown={(event) => { if (event.key === 'Enter') openNotification(n); }}
                style={{
                  display: 'flex', gap: '0.75rem', padding: '0.75rem 1rem',
                  borderBottom: '1px solid var(--border)',
                  cursor: 'pointer',
                  background: n.is_read ? 'transparent' : 'rgba(99, 102, 241, 0.05)',
                  transition: 'background 0.15s ease'
                }}
              >
                <div style={{ marginTop: '0.15rem', flexShrink: 0 }}>{getIcon(n.type)}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: n.is_read ? 400 : 600, color: 'var(--text-primary)' }}>{n.title}</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.15rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.message}</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>{formatTime(n.created_at)}</div>
                  <button className="btn-secondary" onClick={async (event) => { event.stopPropagation(); try { await requestJson('/api/notifications', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: [n.id], snooze_minutes: 60 }) }); setNotifications((current) => current.filter((item) => item.id !== n.id)); } catch (error) { console.error(error); } }}>Snooze 1h</button>
                </div>
                {!n.is_read && (
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent-primary)', flexShrink: 0, marginTop: '0.25rem' }} />
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
