// Microsoft Graph calendar integration: OAuth2 Authorization Code + PKCE flow
// (per Microsoft identity platform docs) and calendarView delta-query sync.
// This entire module is optional — every function is a no-op/clear-error
// until a calendar_sources row is configured via Settings, matching the
// project's "AI is optional, core app never requires it" pattern applied to
// external integrations generally: OmniTool works fine with zero Microsoft
// Graph configuration, showing only locally-created calendar events.
import crypto from 'crypto';
import { getDb, getDefaultWorkspaceId, getSetting } from '../db';
import { v4 as uuidv4 } from 'uuid';
import { encryptServerSecret, decryptServerSecret } from './serverCrypto';
import { CalendarSource } from '../db/schema';

const AUTHORITY = 'https://login.microsoftonline.com';
const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';
const SCOPES = 'offline_access openid profile Calendars.Read';

export function getAppBaseUrl(): string {
  return getSetting('app_base_url') || 'http://localhost:3000';
}

export function getRedirectUri(): string {
  return `${getAppBaseUrl()}/api/calendar/msgraph/callback`;
}

function base64url(input: Buffer): string {
  return input.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function generatePkcePair(): { verifier: string; challenge: string } {
  const verifier = base64url(crypto.randomBytes(32));
  const challenge = base64url(crypto.createHash('sha256').update(verifier).digest());
  return { verifier, challenge };
}

export function generateState(): string {
  return base64url(crypto.randomBytes(16));
}

export function getCalendarSource(): CalendarSource | undefined {
  const db = getDb();
  const wsId = getDefaultWorkspaceId();
  return db.prepare(`SELECT * FROM calendar_sources WHERE workspace_id = ? AND provider = 'microsoft'`).get(wsId) as CalendarSource | undefined;
}

export function saveCalendarSourceConfig(tenantId: string, clientId: string, clientSecret: string): void {
  const db = getDb();
  const wsId = getDefaultWorkspaceId();
  const existing = getCalendarSource();
  const now = new Date().toISOString();
  const enc = encryptServerSecret(clientSecret);

  if (existing) {
    db.prepare(
      `UPDATE calendar_sources SET tenant_id = ?, client_id = ?, client_secret_enc = ?, client_secret_iv = ?, updated_at = ? WHERE id = ?`
    ).run(tenantId, clientId, enc.ciphertext, enc.iv, now, existing.id);
  } else {
    db.prepare(
      `INSERT INTO calendar_sources (id, workspace_id, provider, tenant_id, client_id, client_secret_enc, client_secret_iv, created_at, updated_at)
       VALUES (?, ?, 'microsoft', ?, ?, ?, ?, ?, ?)`
    ).run(uuidv4(), wsId, tenantId, clientId, enc.ciphertext, enc.iv, now, now);
  }
}

export function buildAuthorizeUrl(codeChallenge: string, state: string): string {
  const source = getCalendarSource();
  if (!source) throw new Error('Calendar integration is not configured yet');

  const params = new URLSearchParams({
    client_id: source.client_id,
    response_type: 'code',
    redirect_uri: getRedirectUri(),
    response_mode: 'query',
    scope: SCOPES,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  });

  return `${AUTHORITY}/${source.tenant_id}/oauth2/v2.0/authorize?${params.toString()}`;
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
}

export async function exchangeCodeForTokens(code: string, codeVerifier: string): Promise<TokenResponse> {
  const source = getCalendarSource();
  if (!source) throw new Error('Calendar integration is not configured yet');
  const clientSecret = decryptServerSecret(source.client_secret_enc, source.client_secret_iv);

  const body = new URLSearchParams({
    client_id: source.client_id,
    scope: SCOPES,
    code,
    redirect_uri: getRedirectUri(),
    grant_type: 'authorization_code',
    code_verifier: codeVerifier,
    client_secret: clientSecret,
  });

  const res = await fetch(`${AUTHORITY}/${source.tenant_id}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Microsoft sign-in failed: ${errText.slice(0, 300)}`);
  }

  return res.json();
}

async function refreshTokens(refreshToken: string): Promise<TokenResponse> {
  const source = getCalendarSource();
  if (!source) throw new Error('Calendar integration is not configured yet');
  const clientSecret = decryptServerSecret(source.client_secret_enc, source.client_secret_iv);

  const body = new URLSearchParams({
    client_id: source.client_id,
    scope: SCOPES,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
    client_secret: clientSecret,
  });

  const res = await fetch(`${AUTHORITY}/${source.tenant_id}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Token refresh failed: ${errText.slice(0, 300)}`);
  }

  return res.json();
}

export function storeTokens(tokens: TokenResponse, accountEmail?: string): void {
  const db = getDb();
  const source = getCalendarSource();
  if (!source) throw new Error('Calendar integration is not configured yet');

  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
  const accessEnc = encryptServerSecret(tokens.access_token);

  const updates: string[] = ['access_token_enc = ?', 'access_token_iv = ?', 'token_expires_at = ?', 'updated_at = ?', 'last_sync_error = NULL'];
  const vals: any[] = [accessEnc.ciphertext, accessEnc.iv, expiresAt, now];

  if (tokens.refresh_token) {
    const refreshEnc = encryptServerSecret(tokens.refresh_token);
    updates.push('refresh_token_enc = ?', 'refresh_token_iv = ?');
    vals.push(refreshEnc.ciphertext, refreshEnc.iv);
  }
  if (accountEmail) {
    updates.push('account_email = ?');
    vals.push(accountEmail);
  }

  vals.push(source.id);
  db.prepare(`UPDATE calendar_sources SET ${updates.join(', ')} WHERE id = ?`).run(...vals);
}

async function getValidAccessToken(): Promise<string> {
  const source = getCalendarSource();
  if (!source || !source.access_token_enc) throw new Error('Calendar is not connected yet');

  const expiresAt = source.token_expires_at ? new Date(source.token_expires_at).getTime() : 0;
  if (Date.now() < expiresAt - 60_000) {
    return decryptServerSecret(source.access_token_enc, source.access_token_iv!);
  }

  if (!source.refresh_token_enc) throw new Error('Calendar session expired; please reconnect in Settings');
  const refreshToken = decryptServerSecret(source.refresh_token_enc, source.refresh_token_iv!);
  const tokens = await refreshTokens(refreshToken);
  storeTokens(tokens);
  return tokens.access_token;
}

export interface SyncResult {
  created: number;
  updated: number;
  deleted: number;
}

export async function syncCalendar(): Promise<SyncResult> {
  const db = getDb();
  const wsId = getDefaultWorkspaceId();
  const source = getCalendarSource();
  if (!source) throw new Error('Calendar integration is not configured yet');

  const result: SyncResult = { created: 0, updated: 0, deleted: 0 };

  try {
    const accessToken = await getValidAccessToken();

    let url: string;
    if (source.delta_link) {
      url = source.delta_link;
    } else {
      const start = new Date();
      start.setDate(start.getDate() - 30);
      const end = new Date();
      end.setDate(end.getDate() + 180);
      const params = new URLSearchParams({ startDateTime: start.toISOString(), endDateTime: end.toISOString() });
      url = `${GRAPH_BASE}/me/calendarView/delta?${params.toString()}`;
    }

    let deltaLink: string | null = null;
    let guard = 0;

    while (url && guard < 50) {
      guard++;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}`, Prefer: 'odata.maxpagesize=50' },
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Graph calendar sync failed: ${errText.slice(0, 300)}`);
      }

      const payload: any = await res.json();

      for (const evt of payload.value || []) {
        if (evt['@removed']) {
          const del = db.prepare(`DELETE FROM calendar_events WHERE source_id = ? AND calendar_source_id = ?`).run(evt.id, source.id);
          result.deleted += del.changes;
          continue;
        }

        // Graph returns event times in UTC by default (no outlook.timezone preference set).
        const title = evt.subject || '(No title)';
        const startTime = evt.start?.dateTime ? new Date(`${evt.start.dateTime}Z`).toISOString() : null;
        const endTime = evt.end?.dateTime ? new Date(`${evt.end.dateTime}Z`).toISOString() : null;
        const location = evt.location?.displayName || null;
        const isAllDay = evt.isAllDay ? 1 : 0;
        const webLink = evt.webLink || null;
        if (!startTime || !endTime) continue;

        const existing = db
          .prepare(`SELECT id FROM calendar_events WHERE source_id = ? AND calendar_source_id = ?`)
          .get(evt.id, source.id) as { id: string } | undefined;

        if (existing) {
          db.prepare(
            `UPDATE calendar_events SET title = ?, start_time = ?, end_time = ?, location = ?, is_all_day = ?, external_link = ? WHERE id = ?`
          ).run(title, startTime, endTime, location, isAllDay, webLink, existing.id);
          result.updated++;
        } else {
          db.prepare(
            `INSERT INTO calendar_events (id, workspace_id, source_id, calendar_source_id, title, start_time, end_time, location, is_all_day, external_link, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          ).run(uuidv4(), wsId, evt.id, source.id, title, startTime, endTime, location, isAllDay, webLink, new Date().toISOString());
          result.created++;
        }
      }

      if (payload['@odata.nextLink']) {
        url = payload['@odata.nextLink'];
      } else if (payload['@odata.deltaLink']) {
        deltaLink = payload['@odata.deltaLink'];
        url = '';
      } else {
        url = '';
      }
    }

    const now = new Date().toISOString();
    db.prepare(`UPDATE calendar_sources SET delta_link = ?, last_synced_at = ?, last_sync_error = NULL, updated_at = ? WHERE id = ?`).run(
      deltaLink,
      now,
      now,
      source.id
    );

    return result;
  } catch (err: any) {
    db.prepare(`UPDATE calendar_sources SET last_sync_error = ? WHERE id = ?`).run(err.message || 'Unknown sync error', source.id);
    throw err;
  }
}

export function disconnectCalendar(): void {
  const db = getDb();
  const source = getCalendarSource();
  if (!source) return;
  db.prepare(`DELETE FROM calendar_events WHERE calendar_source_id = ?`).run(source.id);
  db.prepare(`DELETE FROM calendar_sources WHERE id = ?`).run(source.id);
}
