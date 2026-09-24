'use client';

import React, { useState, useEffect, ReactNode } from 'react';
import QuickCaptureModal from '@/components/QuickCaptureModal';
import SearchModal from '@/components/SearchModal';

export default function AppProviders({ children }: { children: ReactNode }) {
  const [isCaptureOpen, setIsCaptureOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [captureMessage, setCaptureMessage] = useState('');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+Space for Quick Capture
      if ((e.ctrlKey || e.metaKey) && e.code === 'Space') {
        e.preventDefault();
        setIsCaptureOpen(true);
      }
      // Cmd+K or Ctrl+K for Search
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    const openCapture = () => setIsCaptureOpen(true);
    window.addEventListener('omnitool:capture', openCapture);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('omnitool:capture', openCapture);
    };
  }, []);

  useEffect(() => {
    const handleCaptured = () => {
      setCaptureMessage('Saved to Inbox');
      window.dispatchEvent(new Event('omnitool:refresh'));
    };
    window.addEventListener('omnitool:captured', handleCaptured);
    return () => window.removeEventListener('omnitool:captured', handleCaptured);
  }, []);

  useEffect(() => {
    if (!captureMessage) return;
    const timeout = window.setTimeout(() => setCaptureMessage(''), 4000);
    return () => window.clearTimeout(timeout);
  }, [captureMessage]);

  return (
    <>
      {children}
      
      <QuickCaptureModal
        isOpen={isCaptureOpen}
        onClose={() => setIsCaptureOpen(false)}
        onSuccess={() => {
          window.dispatchEvent(new Event('omnitool:captured'));
        }}
      />

      {captureMessage && (
        <div role="status" className="capture-feedback">
          {captureMessage} <a href="/inbox">Open Inbox</a>
        </div>
      )}

      <SearchModal 
        isOpen={isSearchOpen} 
        onClose={() => setIsSearchOpen(false)} 
      />
    </>
  );
}
