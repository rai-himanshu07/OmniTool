'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  CheckSquare,
  FolderKanban,
  Clock,
  CheckCircle2,
  FileText,
  Lock,
  Inbox,
  Calendar,
  Settings,
  Plus,
  Compass,
  Search,
  ClipboardCheck,
  RefreshCw,
  UsersRound,
  BookOpen
} from 'lucide-react';

const NAV_ITEMS = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/my-work', label: 'My Work', icon: CheckSquare },
  { href: '/projects', label: 'Projects & Clients', icon: FolderKanban },
  { href: '/teams', label: 'People & Teams', icon: UsersRound },
  { href: '/followups', label: 'Follow-ups', icon: Clock },
  { href: '/cadence', label: 'Cadence', icon: RefreshCw },
  { href: '/calendar', label: 'Calendar', icon: Calendar },
  { href: '/inbox', label: 'Inbox', icon: Inbox },
  { href: '/notes', label: 'Notes', icon: FileText },
  { href: '/notebooks', label: 'Notebooks', icon: BookOpen },
  { href: '/qc', label: 'QC Checklists', icon: CheckCircle2 },
  { href: '/vault', label: 'Secure Vault', icon: Lock },
  { href: '/review', label: 'Day Review', icon: ClipboardCheck },
  { href: '/search', label: 'Search', icon: Search, shortcut: '⌘K' },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export default function Navigation({ role }: { role?: string }) {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname === href || pathname.startsWith(href + '/');
  };

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-icon">
          <Compass size={22} />
        </div>
        <div className="brand-title">OmniTool</div>
      </div>

      <button type="button" onClick={() => window.dispatchEvent(new Event('omnitool:capture'))} className="btn-capture" style={{ marginBottom: '1.5rem', width: '100%' }}>
        <Plus size={18} />
        <span>Quick Capture</span>
        <div className="kbd" style={{ marginLeft: 'auto' }}>Ctrl Space</div>
      </button>

      <nav className="nav-group">
        {NAV_ITEMS.filter((item) => role === 'admin' || !['/settings', '/vault'].includes(item.href)).map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`nav-item ${active ? 'active' : ''}`}
              style={{ textDecoration: 'none' }}
            >
              <Icon size={19} />
              <span>{item.label}</span>
              {item.shortcut && (
                <span className="kbd" style={{ marginLeft: 'auto' }}>{item.shortcut}</span>
              )}
            </Link>
          );
        })}
      </nav>

    </aside>
  );
}
