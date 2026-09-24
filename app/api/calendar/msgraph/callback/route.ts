import { NextRequest, NextResponse } from 'next/server';
import { exchangeCodeForTokens, storeTokens, syncCalendar } from '@/lib/services/msGraphCalendar';

export async function GET(request: NextRequest) {
  const url = request.nextUrl.clone();
  url.pathname = '/settings';

  try {
    const code = request.nextUrl.searchParams.get('code');
    const state = request.nextUrl.searchParams.get('state');
    const oauthError = request.nextUrl.searchParams.get('error_description') || request.nextUrl.searchParams.get('error');

    if (oauthError) throw new Error(oauthError);

    const expectedState = request.cookies.get('omnitool_oauth_state')?.value;
    const verifier = request.cookies.get('omnitool_oauth_verifier')?.value;

    if (!code || !state || !verifier || state !== expectedState) {
      throw new Error('Invalid or expired authorization response — please try connecting again');
    }

    const tokens = await exchangeCodeForTokens(code, verifier);

    let accountEmail: string | undefined;
    try {
      const meRes = await fetch('https://graph.microsoft.com/v1.0/me', {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      if (meRes.ok) {
        const me = await meRes.json();
        accountEmail = me.mail || me.userPrincipalName;
      }
    } catch {
      // Non-fatal — account email is cosmetic only
    }

    storeTokens(tokens, accountEmail);

    try {
      await syncCalendar();
    } catch {
      // Initial sync failure is surfaced via last_sync_error; user can retry from Settings
    }

    url.search = '?calendar=connected';
  } catch (error: any) {
    url.search = `?calendar_error=${encodeURIComponent(error.message)}`;
  }

  const response = NextResponse.redirect(url);
  response.cookies.delete('omnitool_oauth_state');
  response.cookies.delete('omnitool_oauth_verifier');
  return response;
}
