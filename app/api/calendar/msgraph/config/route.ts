import { NextResponse } from 'next/server';
import { getCalendarSource, saveCalendarSourceConfig, disconnectCalendar, getAppBaseUrl } from '@/lib/services/msGraphCalendar';
import { setSetting } from '@/lib/db';

export async function GET() {
  try {
    const source = getCalendarSource();
    return NextResponse.json({
      configured: !!source,
      connected: !!(source && source.access_token_enc),
      tenant_id: source?.tenant_id || null,
      client_id: source?.client_id || null,
      account_email: source?.account_email || null,
      last_synced_at: source?.last_synced_at || null,
      last_sync_error: source?.last_sync_error || null,
      app_base_url: getAppBaseUrl(),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { tenant_id, client_id, client_secret, app_base_url } = body;

    if (!tenant_id || !client_id || !client_secret) {
      return NextResponse.json({ error: 'tenant_id, client_id and client_secret are required' }, { status: 400 });
    }

    if (app_base_url) setSetting('app_base_url', app_base_url.replace(/\/$/, ''));
    saveCalendarSourceConfig(tenant_id, client_id, client_secret);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    disconnectCalendar();
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
