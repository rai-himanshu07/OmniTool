'use client';

import { createContext, useContext, useEffect, useRef, useState, type ReactNode, type FormEvent } from 'react';
import { LockKeyhole } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { requestJson } from '@/lib/client';

const ScreenLockContext = createContext({ enabled: false, lock: () => {} });

export function LockScreenButton() {
  const screenLock = useContext(ScreenLockContext);
  return screenLock.enabled ? <button type="button" className="notification-trigger" title="Lock screen" aria-label="Lock screen" onClick={screenLock.lock}><LockKeyhole size={18} /></button> : null;
}

export default function ScreenLockProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const publicPage = pathname === '/setup' || pathname === '/sign-in' || pathname === '/join';
  const [checking, setChecking] = useState(true);
  const [enabled, setEnabled] = useState(false);
  const [locked, setLocked] = useState(true);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [recovering, setRecovering] = useState(false);
  const [accountPassword, setAccountPassword] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const channel = useRef<BroadcastChannel | null>(null);
  const userId = useRef('');

  const unlockKey = () => `omnitool:unlocked:${userId.current}`;

  const lock = () => {
    sessionStorage.removeItem(unlockKey());
    setLocked(true); setPin(''); setError('');
    channel.current?.postMessage({ action: 'lock', userId: userId.current });
  };
  const loadConfig = async (justChanged = false) => {
    try {
      const response = await fetch('/api/screen-lock');
      if (!response.ok) throw new Error('Could not check screen lock');
      const data = await response.json();
      userId.current = data.user_id;
      setEnabled(!!data.enabled);
      if (justChanged) sessionStorage.setItem(unlockKey(), '1');
      setLocked(!!data.enabled && sessionStorage.getItem(unlockKey()) !== '1');
      setError('');
    } catch { setLocked(true); setError('Could not check screen lock. Retry when the app is available.'); }
    finally { setChecking(false); }
  };

  useEffect(() => {
    if (publicPage) return;
    if (typeof BroadcastChannel !== 'undefined') {
      channel.current = new BroadcastChannel('omnitool-screen-lock');
      channel.current.onmessage = (event) => {
        if (event.data?.userId === userId.current && (event.data.action === 'lock' || event.data.action === 'config')) {
          sessionStorage.removeItem(unlockKey());
          setLocked(true); setPin('');
          if (event.data.action === 'config') loadConfig();
        }
      };
    }
    loadConfig();
    const onLock = () => lock();
    const onChange = () => { loadConfig(true); channel.current?.postMessage({ action: 'config', userId: userId.current }); };
    window.addEventListener('omnitool:lock', onLock);
    window.addEventListener('omnitool:lock-config-changed', onChange);
    return () => { window.removeEventListener('omnitool:lock', onLock); window.removeEventListener('omnitool:lock-config-changed', onChange); channel.current?.close(); channel.current = null; };
  }, [publicPage]);

  useEffect(() => {
    if (publicPage || !enabled || locked) return;
    const reset = () => {
      if (timer.current) clearTimeout(timer.current);
      const minutes = Number(localStorage.getItem('omnitool:idle-minutes') || '15');
      if (minutes > 0 && minutes <= 120) timer.current = setTimeout(lock, minutes * 60_000);
    };
    reset();
    window.addEventListener('pointerdown', reset);
    window.addEventListener('keydown', reset);
    window.addEventListener('omnitool:idle-setting-changed', reset);
    return () => {
      if (timer.current) clearTimeout(timer.current);
      window.removeEventListener('pointerdown', reset);
      window.removeEventListener('keydown', reset);
      window.removeEventListener('omnitool:idle-setting-changed', reset);
    };
  }, [enabled, locked, publicPage]);

  const unlock = async (event: FormEvent) => {
    event.preventDefault();
    try {
      const response = await fetch('/api/screen-lock', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pin }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Incorrect PIN');
      sessionStorage.setItem(unlockKey(), '1');
      setLocked(false); setPin(''); setError('');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not unlock'); setPin(''); }
  };

  if (publicPage) return children;
  if (checking || locked) return <div className="screen-lock"><form className="screen-lock-form" onSubmit={unlock}>
    <LockKeyhole size={26} aria-hidden="true" />
    <h1>{checking ? 'Opening workspace' : 'Workspace locked'}</h1>
    {!checking && enabled && <><input aria-label="Four-digit PIN" type="password" inputMode="numeric" autoComplete="off" maxLength={4} pattern="[0-9]{4}" value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, '').slice(0, 4))} autoFocus /><button type="submit" className="btn-capture" disabled={pin.length !== 4}>Unlock</button></>}
    {!checking && !enabled && <button type="button" className="btn-secondary" onClick={() => loadConfig()}>Retry</button>}
    {error && <p role="alert" className="work-error">{error}</p>}
    {!checking && enabled && <button type="button" className="btn-secondary" onClick={() => setRecovering(!recovering)}>Forgot PIN?</button>}
    {recovering && <><input aria-label="Account password for PIN recovery" type="password" autoComplete="current-password" value={accountPassword} onChange={(event) => setAccountPassword(event.target.value)} /><button type="button" className="btn-secondary" disabled={!accountPassword} onClick={async () => { try { await requestJson('/api/screen-lock/reset', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: accountPassword }) }); setAccountPassword(''); setRecovering(false); await loadConfig(true); window.dispatchEvent(new Event('omnitool:lock-config-changed')); } catch (cause) { setError(String(cause)); } }}>Reset PIN with account password</button></>}
  </form></div>;

  return <ScreenLockContext.Provider value={{ enabled, lock }}>{children}</ScreenLockContext.Provider>;
}