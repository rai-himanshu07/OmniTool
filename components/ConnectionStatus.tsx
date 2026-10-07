'use client';
import { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';
export default function ConnectionStatus() {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const connected = () => setOnline(true);
    const disconnected = () => setOnline(false);
    setOnline(navigator.onLine);
    window.addEventListener('online', connected); window.addEventListener('offline', disconnected); window.addEventListener('omnitool:connection-failed', disconnected); window.addEventListener('omnitool:connection-restored', connected);
    return () => { window.removeEventListener('online', connected); window.removeEventListener('offline', disconnected); window.removeEventListener('omnitool:connection-failed', disconnected); window.removeEventListener('omnitool:connection-restored', connected); };
  }, []);
  return online ? null : <div className="connection-status" role="alert"><WifiOff size={16} /> Connection unavailable. Unsaved changes have not reached the server. <button className="btn-secondary" onClick={async () => { try { const response = await fetch('/api/me'); if (response.ok) setOnline(true); } catch {} }}>Retry connection</button></div>;
}