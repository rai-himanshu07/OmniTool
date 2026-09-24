'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Lock, Unlock, Key, Plus, ShieldCheck, Pencil, Trash2, KeyRound, X, Save } from 'lucide-react';
import { deriveVaultKey, encryptText, decryptText, generateSaltHex } from '@/lib/services/vaultCrypto';

const VAULT_CHECK_PLAINTEXT = 'omnitool_vault_valid';
const NEW_VAULT_ITERATIONS = 600000;
const AUTO_LOCK_HIDDEN_MS = 5 * 60 * 1000; // lock after 5 minutes in a hidden/backgrounded tab

interface DecryptedNote {
  id: string;
  title: string;
  content: string;
  created_at: string;
}

interface RawSecureNote {
  id: string;
  title_encrypted: string;
  title_iv: string;
  content_encrypted: string;
  content_iv: string;
}

export default function VaultView() {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [password, setPassword] = useState('');
  const [cryptoKey, setCryptoKey] = useState<CryptoKey | null>(null);
  const [salt, setSalt] = useState<string>('');
  const [kdfIterations, setKdfIterations] = useState<number>(NEW_VAULT_ITERATIONS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isInitialized, setIsInitialized] = useState(false);

  const [notes, setNotes] = useState<DecryptedNote[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');

  const [showChangePassword, setShowChangePassword] = useState(false);
  const [currentPasswordInput, setCurrentPasswordInput] = useState('');
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('');
  const [changePasswordError, setChangePasswordError] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [changePasswordSuccess, setChangePasswordSuccess] = useState(false);

  const cryptoKeyRef = useRef<CryptoKey | null>(null);
  const hiddenTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetchVaultMeta();
  }, []);

  const lockVault = () => {
    setIsUnlocked(false);
    setCryptoKey(null);
    cryptoKeyRef.current = null;
    setPassword('');
    setNotes([]);
    setEditingId(null);
    setShowChangePassword(false);
  };

  // Locks the moment the user navigates away from the vault (component
  // unmounts) — matches "vault locks immediately when the user leaves it".
  useEffect(() => {
    return () => {
      cryptoKeyRef.current = null;
    };
  }, []);

  // Idle/backgrounded-tab safeguard: lock after being hidden for a while.
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) {
        if (cryptoKeyRef.current && !hiddenTimerRef.current) {
          hiddenTimerRef.current = setTimeout(() => {
            lockVault();
            hiddenTimerRef.current = null;
          }, AUTO_LOCK_HIDDEN_MS);
        }
      } else if (hiddenTimerRef.current) {
        clearTimeout(hiddenTimerRef.current);
        hiddenTimerRef.current = null;
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      if (hiddenTimerRef.current) clearTimeout(hiddenTimerRef.current);
    };
  }, []);

  const fetchVaultMeta = async () => {
    try {
      const res = await fetch('/api/vault/meta');
      const data = await res.json();
      if (data.meta && data.meta.is_initialized) {
        setIsInitialized(true);
        setSalt(data.meta.key_salt);
        setKdfIterations(data.meta.kdf_iterations || 100000);
      } else {
        setIsInitialized(false);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;

    setLoading(true);
    setError('');

    try {
      let currentSalt = salt;
      if (!isInitialized) {
        currentSalt = generateSaltHex();
        const derivedKey = await deriveVaultKey(password, currentSalt, NEW_VAULT_ITERATIONS);
        const testEnc = await encryptText(VAULT_CHECK_PLAINTEXT, derivedKey);

        await fetch('/api/vault/meta', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            key_salt: currentSalt,
            test_ciphertext: testEnc.ciphertext,
            test_iv: testEnc.iv,
            kdf_iterations: NEW_VAULT_ITERATIONS
          })
        });
        setSalt(currentSalt);
        setKdfIterations(NEW_VAULT_ITERATIONS);
        setIsInitialized(true);
        setCryptoKey(derivedKey);
        cryptoKeyRef.current = derivedKey;
        setIsUnlocked(true);
        loadVaultNotes(derivedKey);
      } else {
        const res = await fetch('/api/vault/meta');
        const data = await res.json();
        const iterations = data.meta.kdf_iterations || 100000;
        const derivedKey = await deriveVaultKey(password, data.meta.key_salt, iterations);

        try {
          const testDec = await decryptText(data.meta.test_ciphertext, data.meta.test_iv, derivedKey);
          if (testDec === VAULT_CHECK_PLAINTEXT) {
            setKdfIterations(iterations);
            setCryptoKey(derivedKey);
            cryptoKeyRef.current = derivedKey;
            setIsUnlocked(true);
            loadVaultNotes(derivedKey);
          } else {
            setError('Invalid Vault Password');
          }
        } catch {
          setError('Invalid Vault Password');
        }
      }
    } catch (err: any) {
      setError(err.message || 'Vault unlock failed');
    } finally {
      setLoading(false);
    }
  };

  const loadVaultNotes = async (key: CryptoKey) => {
    try {
      const res = await fetch('/api/vault/notes');
      const data = await res.json();
      const rawNotes = data.notes || [];

      const decrypted: DecryptedNote[] = [];
      for (const n of rawNotes) {
        try {
          const t = await decryptText(n.title_encrypted, n.title_iv, key);
          const c = await decryptText(n.content_encrypted, n.content_iv, key);
          decrypted.push({
            id: n.id,
            title: t,
            content: c,
            created_at: n.created_at
          });
        } catch (err) {
          console.error('Failed to decrypt note', n.id, err);
        }
      }
      setNotes(decrypted);
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateSecureNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newContent.trim() || !cryptoKey) return;

    try {
      const encTitle = await encryptText(newTitle.trim(), cryptoKey);
      const encContent = await encryptText(newContent.trim(), cryptoKey);

      await fetch('/api/vault/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title_encrypted: encTitle.ciphertext,
          title_iv: encTitle.iv,
          content_encrypted: encContent.ciphertext,
          content_iv: encContent.iv
        })
      });

      setNewTitle('');
      setNewContent('');
      setShowAddForm(false);
      loadVaultNotes(cryptoKey);
    } catch (err) {
      console.error(err);
    }
  };

  const startEditNote = (note: DecryptedNote) => {
    setEditingId(note.id);
    setEditTitle(note.title);
    setEditContent(note.content);
  };

  const handleSaveEditNote = async () => {
    if (!editingId || !cryptoKey || !editTitle.trim() || !editContent.trim()) return;
    try {
      const encTitle = await encryptText(editTitle.trim(), cryptoKey);
      const encContent = await encryptText(editContent.trim(), cryptoKey);
      await fetch(`/api/vault/notes/${editingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title_encrypted: encTitle.ciphertext,
          title_iv: encTitle.iv,
          content_encrypted: encContent.ciphertext,
          content_iv: encContent.iv
        })
      });
      setEditingId(null);
      loadVaultNotes(cryptoKey);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteSecureNote = async (id: string) => {
    if (!cryptoKey) return;
    if (!confirm('Permanently delete this secure note? This cannot be undone.')) return;
    try {
      await fetch(`/api/vault/notes/${id}`, { method: 'DELETE' });
      loadVaultNotes(cryptoKey);
    } catch (err) {
      console.error(err);
    }
  };

  const handleLock = () => {
    lockVault();
  };

  const handleChangePassword = async () => {
    setChangePasswordError('');
    setChangePasswordSuccess(false);

    if (!currentPasswordInput || !newPasswordInput) {
      setChangePasswordError('Enter your current and new password.');
      return;
    }
    if (newPasswordInput !== newPasswordConfirm) {
      setChangePasswordError('New password confirmation does not match.');
      return;
    }
    if (newPasswordInput.length < 8) {
      setChangePasswordError('Choose a new password of at least 8 characters.');
      return;
    }

    setChangingPassword(true);
    try {
      const metaRes = await fetch('/api/vault/meta');
      const metaData = await metaRes.json();
      const oldIterations = metaData.meta.kdf_iterations || 100000;
      const oldKey = await deriveVaultKey(currentPasswordInput, metaData.meta.key_salt, oldIterations);

      try {
        const testDec = await decryptText(metaData.meta.test_ciphertext, metaData.meta.test_iv, oldKey);
        if (testDec !== VAULT_CHECK_PLAINTEXT) throw new Error('mismatch');
      } catch {
        setChangePasswordError('Current password is incorrect.');
        setChangingPassword(false);
        return;
      }

      const rawRes = await fetch('/api/vault/notes');
      const rawData = await rawRes.json();
      const rawNotes: RawSecureNote[] = rawData.notes || [];

      const newSalt = generateSaltHex();
      const newKey = await deriveVaultKey(newPasswordInput, newSalt, NEW_VAULT_ITERATIONS);

      const reEncryptedNotes = [];
      for (const n of rawNotes) {
        const title = await decryptText(n.title_encrypted, n.title_iv, oldKey);
        const content = await decryptText(n.content_encrypted, n.content_iv, oldKey);
        const encTitle = await encryptText(title, newKey);
        const encContent = await encryptText(content, newKey);
        reEncryptedNotes.push({
          id: n.id,
          title_encrypted: encTitle.ciphertext,
          title_iv: encTitle.iv,
          content_encrypted: encContent.ciphertext,
          content_iv: encContent.iv
        });
      }

      const newTestEnc = await encryptText(VAULT_CHECK_PLAINTEXT, newKey);

      const changeRes = await fetch('/api/vault/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key_salt: newSalt,
          test_ciphertext: newTestEnc.ciphertext,
          test_iv: newTestEnc.iv,
          kdf_iterations: NEW_VAULT_ITERATIONS,
          notes: reEncryptedNotes
        })
      });

      if (!changeRes.ok) throw new Error('Server rejected the password change');

      setSalt(newSalt);
      setKdfIterations(NEW_VAULT_ITERATIONS);
      setCryptoKey(newKey);
      cryptoKeyRef.current = newKey;
      setCurrentPasswordInput('');
      setNewPasswordInput('');
      setNewPasswordConfirm('');
      setChangePasswordSuccess(true);
      loadVaultNotes(newKey);
    } catch (err: any) {
      setChangePasswordError(err.message || 'Could not change vault password.');
    } finally {
      setChangingPassword(false);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Lock color="var(--purple)" size={24} />
            <span>Secure Vault</span>
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Zero-knowledge AES-256 encrypted storage • Client-side key derivation ({kdfIterations.toLocaleString()} PBKDF2 iterations)
          </p>
        </div>
        {isUnlocked && (
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn-capture" onClick={() => setShowAddForm(!showAddForm)}>
              <Plus size={18} />
              <span>New Secure Note</span>
            </button>
            <button className="btn-secondary" onClick={() => setShowChangePassword(!showChangePassword)} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <KeyRound size={16} />
              <span>Change Password</span>
            </button>
            <button className="btn-secondary" onClick={handleLock} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <Lock size={16} />
              <span>Lock Vault</span>
            </button>
          </div>
        )}
      </div>

      {!isUnlocked ? (
        <div className="card" style={{ maxWidth: '480px', margin: '3rem auto', textAlign: 'center', padding: '2.5rem 2rem' }}>
          <div style={{ width: '60px', height: '60px', borderRadius: 'var(--radius-full)', background: 'rgba(168, 85, 247, 0.15)', color: 'var(--purple)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem auto' }}>
            <ShieldCheck size={32} />
          </div>

          <h2 style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
            {isInitialized ? 'Unlock Secure Vault' : 'Initialize Secure Vault'}
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
            Enter your master password. Keys are derived locally on your device using PBKDF2 with SHA-256. There is no
            recovery if this password is forgotten — that is what makes it zero-knowledge.
          </p>

          <form onSubmit={handleUnlock}>
            <input
              type="password"
              className="input-field"
              placeholder="Vault Master Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ marginBottom: '1rem', textAlign: 'center' }}
              required
            />
            {error && <div style={{ color: 'var(--rose)', fontSize: '0.85rem', marginBottom: '1rem' }}>{error}</div>}

            <button type="submit" className="btn-capture" style={{ width: '100%', justifyContent: 'center' }} disabled={loading}>
              <Unlock size={18} />
              <span>{loading ? 'Deriving Key...' : isInitialized ? 'Unlock Vault' : 'Create & Encrypt Vault'}</span>
            </button>
          </form>
        </div>
      ) : (
        <div>
          {showChangePassword && (
            <div className="card" style={{ marginBottom: '1.5rem', borderColor: 'rgba(168, 85, 247, 0.3)' }}>
              <div className="card-title" style={{ color: 'var(--purple)' }}>
                <span>Change Vault Master Password</span>
                <X size={16} style={{ cursor: 'pointer' }} onClick={() => setShowChangePassword(false)} />
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                Every secure note is decrypted locally with your current password and re-encrypted with the new one in a
                single atomic operation. Nothing is stored in plaintext at any point.
              </p>
              <div style={{ display: 'grid', gap: '0.75rem', marginBottom: '1rem' }}>
                <input type="password" className="input-field" placeholder="Current password" value={currentPasswordInput} onChange={(e) => setCurrentPasswordInput(e.target.value)} />
                <input type="password" className="input-field" placeholder="New password" value={newPasswordInput} onChange={(e) => setNewPasswordInput(e.target.value)} />
                <input type="password" className="input-field" placeholder="Confirm new password" value={newPasswordConfirm} onChange={(e) => setNewPasswordConfirm(e.target.value)} />
              </div>
              {changePasswordError && <div style={{ color: 'var(--rose)', fontSize: '0.85rem', marginBottom: '1rem' }}>{changePasswordError}</div>}
              {changePasswordSuccess && <div style={{ color: 'var(--success)', fontSize: '0.85rem', marginBottom: '1rem' }}>Vault password changed successfully.</div>}
              <button className="btn-capture" style={{ background: 'var(--purple)' }} onClick={handleChangePassword} disabled={changingPassword}>
                {changingPassword ? 'Re-encrypting vault...' : 'Change password'}
              </button>
            </div>
          )}

          {showAddForm && (
            <form className="card" onSubmit={handleCreateSecureNote} style={{ marginBottom: '1.5rem' }}>
              <div className="card-title" style={{ color: 'var(--purple)' }}>Create Encrypted Note</div>
              <input
                type="text"
                className="input-field"
                placeholder="Title (Encrypted)"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                style={{ marginBottom: '1rem' }}
                required
              />
              <textarea
                className="input-field"
                placeholder="Private note content (Encrypted AES-GCM)..."
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                style={{ marginBottom: '1rem', height: '120px' }}
                required
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                <button type="button" className="btn-secondary" onClick={() => setShowAddForm(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-capture" style={{ background: 'var(--purple)' }}>
                  Encrypt & Save
                </button>
              </div>
            </form>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem' }}>
            {notes.map((n) => (
              <div key={n.id} className="card" style={{ borderColor: 'rgba(168, 85, 247, 0.3)' }}>
                {editingId === n.id ? (
                  <div>
                    <input className="input-field" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} style={{ marginBottom: '0.75rem' }} />
                    <textarea className="input-field" value={editContent} onChange={(e) => setEditContent(e.target.value)} style={{ marginBottom: '0.75rem', height: '100px' }} />
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                      <button className="btn-secondary" onClick={() => setEditingId(null)}>Cancel</button>
                      <button className="btn-capture" style={{ background: 'var(--purple)', display: 'flex', alignItems: 'center', gap: '0.3rem' }} onClick={handleSaveEditNote}>
                        <Save size={14} /> Save
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                      <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>{n.title}</h3>
                      <span className="badge badge-purple">AES-256</span>
                    </div>
                    <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', marginBottom: '0.75rem' }}>{n.content}</p>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid var(--border-subtle)' }}>
                      <button onClick={() => startEditNote(n)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.8rem' }}>
                        <Pencil size={13} /> Edit
                      </button>
                      <button onClick={() => handleDeleteSecureNote(n.id)} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.8rem' }}>
                        <Trash2 size={13} /> Delete
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
