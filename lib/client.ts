'use client';

import { useEffect, useState } from 'react';

export function usePanelCollapsed(key: string) {
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => { try { setCollapsed(localStorage.getItem(`omnitool:panel:${key}`) === 'collapsed'); } catch {} }, [key]);
  const update = (value: boolean) => { setCollapsed(value); try { localStorage.setItem(`omnitool:panel:${key}`, value ? 'collapsed' : 'expanded'); } catch {} };
  return [collapsed, update] as const;
}

export function useColumnWidths(key: string, columns: { id: string; width: number }[]) {
  const [saved, setSaved] = useState<{ key: string; values: Record<string, number> }>({ key: '', values: {} });
  const storageKey = `omnitool:columns:${key}`;
  useEffect(() => {
    try {
      const parsed = JSON.parse(localStorage.getItem(storageKey) || '{}');
      const values = parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? Object.fromEntries(Object.entries(parsed).filter(([, value]) => typeof value === 'number' && Number.isFinite(value) && value >= 88 && value <= 800)) as Record<string, number> : {};
      setSaved({ key: storageKey, values });
    } catch { setSaved({ key: storageKey, values: {} }); }
  }, [storageKey]);
  const widths = columns.map((column) => saved.key === storageKey ? saved.values[column.id] || column.width : column.width);
  const setWidth = (id: string, width: number) => {
    if (!Number.isFinite(width)) return;
    setSaved((current) => {
      const values = { ...(current.key === storageKey ? current.values : {}), [id]: Math.max(88, Math.min(800, Math.round(width))) };
      try { localStorage.setItem(storageKey, JSON.stringify(values)); } catch {}
      return { key: storageKey, values };
    });
  };
  const reset = () => { setSaved({ key: storageKey, values: {} }); try { localStorage.removeItem(storageKey); } catch {} };
  return { widths, setWidth, reset };
}

export async function requestJson<T = any>(url: string, options?: RequestInit): Promise<T> {
  let response: Response;
  try { response = await fetch(url, options); window.dispatchEvent(new Event('omnitool:connection-restored')); }
  catch (error) { if (options?.signal?.aborted || error instanceof Error && error.name === 'AbortError') throw error; window.dispatchEvent(new Event('omnitool:connection-failed')); throw new Error('Connection unavailable. Your changes have not been saved. Retry when connected.'); }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status}). Your changes have not been saved.`);
  if (data.trash_id) window.dispatchEvent(new CustomEvent('omnitool:trashed', { detail: data.trash_id }));
  return data as T;
}

export function useUnsavedChanges(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const beforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    const onLink = (event: MouseEvent) => {
      const link = (event.target as Element).closest?.('a[href]') as HTMLAnchorElement | null;
      if (link && link.target !== '_blank' && link.href !== window.location.href && !window.confirm('Leave without saving your changes?')) {
        event.preventDefault(); event.stopPropagation();
      }
    };
    window.addEventListener('beforeunload', beforeUnload);
    document.addEventListener('click', onLink, true);
    return () => { window.removeEventListener('beforeunload', beforeUnload); document.removeEventListener('click', onLink, true); };
  }, [dirty]);
}