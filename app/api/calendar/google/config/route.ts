import { NextResponse } from 'next/server';
import { getGoogleSource, saveGoogleConfig, disconnectGoogle } from '@/lib/services/googleCalendar';
import { getAppBaseUrl } from '@/lib/services/msGraphCalendar';
import { setSetting } from '@/lib/db';

export async function GET() {
  const source = getGoogleSource();
  return NextResponse.json({ configured: !!source, connected: !!source?.refresh_token_enc,
    client_id: source?.client_id || null, last_synced_at: source?.last_synced_at || null,
    last_sync_error: source?.last_sync_error || null, app_base_url: getAppBaseUrl() });
}

export async function POST(request: Request) {
  try {
    const { client_id, client_secret, app_base_url } = await request.json();
    if (typeof client_id !== 'string' || !client_id.trim() || typeof client_secret !== 'string' || !client_secret.trim()) {
      return NextResponse.json({ error: 'Client ID and client secret are required' }, { status: 400 });
    }
    if (app_base_url) {
      const url = new URL(app_base_url);
      if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
        return NextResponse.json({ error: 'Enter a valid app origin without a path' }, { status: 400 });
      }
      setSetting('app_base_url', url.origin);
    }
    saveGoogleConfig(client_id.trim(), client_secret.trim());
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not save Google credentials' }, { status: 400 });
  }
}

export async function DELETE() {
  disconnectGoogle();
  return NextResponse.json({ success: true });
}