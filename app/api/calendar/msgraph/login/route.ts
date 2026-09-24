import { NextRequest, NextResponse } from 'next/server';
import { buildAuthorizeUrl, generatePkcePair, generateState } from '@/lib/services/msGraphCalendar';

export async function GET(request: NextRequest) {
  try {
    const { verifier, challenge } = generatePkcePair();
    const state = generateState();
    const authorizeUrl = buildAuthorizeUrl(challenge, state);

    const response = NextResponse.redirect(authorizeUrl);
    const cookieOpts = { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' as const, maxAge: 600, path: '/' };
    response.cookies.set('omnitool_oauth_verifier', verifier, cookieOpts);
    response.cookies.set('omnitool_oauth_state', state, cookieOpts);
    return response;
  } catch (error: any) {
    const url = request.nextUrl.clone();
    url.pathname = '/settings';
    url.search = `?calendar_error=${encodeURIComponent(error.message)}`;
    return NextResponse.redirect(url);
  }
}
