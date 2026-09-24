'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { LockKeyhole } from 'lucide-react';
import { authClient } from '@/lib/authClient';

export default function AuthForm({ mode }: { mode: 'setup' | 'sign-in' | 'join' }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (mode !== 'join') return;
    const fragment = new URLSearchParams(window.location.hash.slice(1));
    setToken(fragment.get('token') || '');
    window.history.replaceState(null, '', '/join');
  }, [mode]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (mode === 'join' && !token) { setError('Invitation link is missing or expired.'); return; }
    setBusy(true); setError('');
    try {
      const result = mode === 'sign-in'
        ? await authClient.signIn.email({ email: email.trim(), password })
        : await authClient.signUp.email({ name: name.trim(), email: email.trim(), password,
            ...(mode === 'join' ? { fetchOptions: { headers: { 'x-omnitool-invite': token } } } : {}) });
      if (result.error) throw new Error(result.error.message || 'Authentication failed');
      setPassword('');
      window.location.assign('/');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Authentication failed');
      setBusy(false);
    }
  };

  return <section className="auth-form-panel">
    <div className="auth-heading"><LockKeyhole size={24} /><h1>{mode === 'setup' ? 'Set up OmniTool' : mode === 'join' ? 'Join workspace' : 'Sign in'}</h1></div>
    <form onSubmit={submit}>
      {mode !== 'sign-in' && <div className="form-group"><label htmlFor="auth-name" className="form-label">Name</label><input id="auth-name" className="form-input" autoComplete="name" required maxLength={120} value={name} onChange={(event) => setName(event.target.value)} /></div>}
      <div className="form-group"><label htmlFor="auth-email" className="form-label">Email</label><input id="auth-email" className="form-input" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></div>
      <div className="form-group"><label htmlFor="auth-password" className="form-label">Password</label><input id="auth-password" className="form-input" type="password" minLength={12} autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'} required value={password} onChange={(event) => setPassword(event.target.value)} /></div>
      {error && <p role="alert" className="work-error">{error}</p>}
      <button type="submit" className="btn-capture" disabled={busy}>{busy ? 'Please wait...' : mode === 'sign-in' ? 'Sign in' : mode === 'join' ? 'Join' : 'Create administrator'}</button>
    </form>
  </section>;
}