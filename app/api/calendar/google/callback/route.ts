import { NextRequest, NextResponse } from 'next/server';
import { connectGoogle, syncGoogleCalendar } from '@/lib/services/googleCalendar';

export async function GET(request: NextRequest) {
  const url = new URL('/settings', request.url);
  try {
    const code = request.nextUrl.searchParams.get('code');
    const state = request.nextUrl.searchParams.get('state');
    const verifier = request.cookies.get('omnitool_google_verifier')?.value;
    if (request.nextUrl.searchParams.get('error')) throw new Error('Google authorization was declined');
    if (!code || !state || !verifier || state !== request.cookies.get('omnitool_google_state')?.value) {
      throw new Error('Invalid or expired Google authorization; try again');
    }
    await connectGoogle(code, verifier);
    try { await syncGoogleCalendar(); } catch { /* Sync errors are recorded for retry in Settings. */ }
    url.searchParams.set('google_calendar', 'connected');
  } catch (error) {
    url.searchParams.set('google_error', error instanceof Error ? error.message : 'Google connection failed');
  }
  const response = NextResponse.redirect(url);
  response.cookies.delete('omnitool_google_state');
  response.cookies.delete('omnitool_google_verifier');
  return response;
}