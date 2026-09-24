import { randomBytes } from 'crypto';
import { google } from 'googleapis';
import { NextRequest, NextResponse } from 'next/server';
import { googleAuthorization } from '@/lib/services/googleCalendar';

export async function GET(request: NextRequest) {
  try {
    const { codeVerifier, codeChallenge } = await new google.auth.OAuth2().generateCodeVerifierAsync();
    if (!codeChallenge) throw new Error('Could not create Google authorization challenge');
    const state = randomBytes(24).toString('base64url');
    const response = NextResponse.redirect(googleAuthorization(state, codeChallenge));
    const options = { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' as const, maxAge: 600, path: '/' };
    response.cookies.set('omnitool_google_state', state, options);
    response.cookies.set('omnitool_google_verifier', codeVerifier, options);
    return response;
  } catch (error) {
    const url = new URL('/settings', request.url);
    url.searchParams.set('google_error', error instanceof Error ? error.message : 'Could not connect Google');
    return NextResponse.redirect(url);
  }
}