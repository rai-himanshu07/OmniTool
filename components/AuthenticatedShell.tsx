'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { LogOut } from 'lucide-react';
import Navigation from '@/components/Navigation';
import NotificationPanel from '@/components/NotificationPanel';
import { LockScreenButton } from '@/components/ScreenLockProvider';
import { authClient } from '@/lib/authClient';
import UndoNotice from '@/components/UndoNotice';
import ConnectionStatus from '@/components/ConnectionStatus';
import { usePanelCollapsed } from '@/lib/client';

export default function AuthenticatedShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [navigationCollapsed, setNavigationCollapsed] = usePanelCollapsed('navigation');
  const [user, setUser] = useState<{ id: string; name: string; role: string } | null>(null);
  useEffect(() => {
    if (pathname === '/setup' || pathname === '/sign-in' || pathname === '/join') return;
    fetch('/api/me').then(async (response) => {
      if (response.status === 401) { window.location.assign('/sign-in'); return null; }
      return response.ok ? response.json() : null;
    }).then((account) => { if (account) setUser(account); }).catch(() => undefined);
  }, [pathname]);

  if (pathname === '/setup' || pathname === '/sign-in' || pathname === '/join') return <main className="auth-shell">{children}</main>;
  return <div className={`app-shell ${navigationCollapsed ? 'is-nav-collapsed' : ''}`}>
    <Navigation role={user?.role} collapsed={navigationCollapsed} onToggle={() => setNavigationCollapsed(!navigationCollapsed)} />
    <main className="app-main">
      <header className="utility-bar"><span>Workspace</span><div className="utility-actions"><span>{user?.name}</span>{user?.role !== 'viewer' && <NotificationPanel />}<LockScreenButton /><button type="button" className="notification-trigger" title="Sign out" aria-label="Sign out" onClick={async () => { if (user) sessionStorage.removeItem(`omnitool:unlocked:${user.id}`); await authClient.signOut(); window.location.assign('/sign-in'); }}><LogOut size={18} /></button></div></header>
      {children}
      <footer className="app-footer"><span>OmniTool contributors</span><a href="https://www.gnu.org/licenses/gpl-3.0.html" target="_blank" rel="noopener noreferrer">GPL-3.0-only</a><span>No warranty</span></footer>
      <UndoNotice />
      <ConnectionStatus />
    </main>
  </div>;
}