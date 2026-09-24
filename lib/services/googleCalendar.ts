import { google, calendar_v3 } from 'googleapis';
import { CodeChallengeMethod } from 'google-auth-library';
import { v4 as uuidv4 } from 'uuid';
import { getDb, getDefaultWorkspaceId } from '../db';
import { CalendarSource } from '../db/schema';
import { decryptServerSecret, encryptServerSecret } from './serverCrypto';
import { getAppBaseUrl } from './msGraphCalendar';

const SCOPE = 'https://www.googleapis.com/auth/calendar.events.readonly';
const MAX_PAGES = 50;

export function getGoogleSource(): CalendarSource | undefined {
  return getDb().prepare("SELECT * FROM calendar_sources WHERE workspace_id = ? AND provider = 'google'")
    .get(getDefaultWorkspaceId()) as CalendarSource | undefined;
}

export function getGoogleRedirectUri(): string {
  return `${getAppBaseUrl()}/api/calendar/google/callback`;
}

function oauthClient(source: CalendarSource) {
  return new google.auth.OAuth2(source.client_id,
    decryptServerSecret(source.client_secret_enc, source.client_secret_iv), getGoogleRedirectUri());
}

export function saveGoogleConfig(clientId: string, clientSecret: string): void {
  const db = getDb();
  const source = getGoogleSource();
  const encrypted = encryptServerSecret(clientSecret);
  const now = new Date().toISOString();
  if (source) {
    db.prepare(`UPDATE calendar_sources SET client_id = ?, client_secret_enc = ?, client_secret_iv = ?,
        access_token_enc = NULL, access_token_iv = NULL, refresh_token_enc = NULL, refresh_token_iv = NULL,
        token_expires_at = NULL, last_synced_at = NULL, last_sync_error = NULL, updated_at = ? WHERE id = ?`)
      .run(clientId, encrypted.ciphertext, encrypted.iv, now, source.id);
  } else {
    db.prepare(`INSERT INTO calendar_sources
      (id, workspace_id, provider, tenant_id, client_id, client_secret_enc, client_secret_iv, created_at, updated_at)
      VALUES (?, ?, 'google', '', ?, ?, ?, ?, ?)`)
      .run(uuidv4(), getDefaultWorkspaceId(), clientId, encrypted.ciphertext, encrypted.iv, now, now);
  }
}

export function googleAuthorization(state: string, challenge: string): string {
  const source = getGoogleSource();
  if (!source) throw new Error('Google Calendar is not configured');
  return oauthClient(source).generateAuthUrl({ access_type: 'offline', prompt: 'consent', scope: SCOPE,
    state, code_challenge: challenge, code_challenge_method: CodeChallengeMethod.S256 });
}

function storeTokens(source: CalendarSource, tokens: { access_token?: string | null; refresh_token?: string | null; expiry_date?: number | null }): void {
  const updates: string[] = ['updated_at = ?'];
  const values: (string | null)[] = [new Date().toISOString()];
  if (tokens.access_token) {
    const encrypted = encryptServerSecret(tokens.access_token);
    updates.push('access_token_enc = ?', 'access_token_iv = ?');
    values.push(encrypted.ciphertext, encrypted.iv);
  }
  if (tokens.refresh_token) {
    const encrypted = encryptServerSecret(tokens.refresh_token);
    updates.push('refresh_token_enc = ?', 'refresh_token_iv = ?');
    values.push(encrypted.ciphertext, encrypted.iv);
  }
  if (tokens.expiry_date) {
    updates.push('token_expires_at = ?');
    values.push(new Date(tokens.expiry_date).toISOString());
  }
  values.push(source.id);
  getDb().prepare(`UPDATE calendar_sources SET ${updates.join(', ')} WHERE id = ?`).run(...values);
}

export async function connectGoogle(code: string, verifier: string): Promise<void> {
  const source = getGoogleSource();
  if (!source) throw new Error('Google Calendar is not configured');
  const client = oauthClient(source);
  const { tokens } = await client.getToken({ code, codeVerifier: verifier });
  if (!tokens.refresh_token && !source.refresh_token_enc) throw new Error('Google did not return offline access. Reconnect and approve access again.');
  storeTokens(source, tokens);
}

function eventTime(value?: calendar_v3.Schema$EventDateTime): string | null {
  const input = value?.dateTime || (value?.date ? `${value.date}T00:00:00Z` : null);
  if (!input) return null;
  const parsed = new Date(input);
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : null;
}

export async function syncGoogleCalendar(): Promise<{ created: number; updated: number; deleted: number }> {
  const source = getGoogleSource();
  if (!source?.refresh_token_enc) throw new Error('Google Calendar is not connected');
  const db = getDb();
  const client = oauthClient(source);
  client.setCredentials({
    refresh_token: decryptServerSecret(source.refresh_token_enc, source.refresh_token_iv!),
    access_token: source.access_token_enc ? decryptServerSecret(source.access_token_enc, source.access_token_iv!) : undefined,
    expiry_date: source.token_expires_at ? Date.parse(source.token_expires_at) : 0,
  });
  client.on('tokens', (tokens) => storeTokens(source, tokens));
  const calendar = google.calendar({ version: 'v3', auth: client });
  const start = new Date();
  start.setDate(start.getDate() - 30);
  const end = new Date();
  end.setDate(end.getDate() + 180);
  const staged = new Map<string, { title: string; start: string; end: string; location: string | null; allDay: number; link: string | null }>();
  let pageToken: string | undefined;

  try {
    for (let page = 0; page < MAX_PAGES; page++) {
      const response = await calendar.events.list({ calendarId: 'primary', singleEvents: true,
        timeMin: start.toISOString(), timeMax: end.toISOString(), maxResults: 250, pageToken });
      for (const event of response.data.items || []) {
        if (!event.id || event.status === 'cancelled') continue;
        const startTime = eventTime(event.start || undefined);
        const endTime = eventTime(event.end || undefined);
        if (!startTime || !endTime) continue;
        staged.set(event.id, { title: event.summary || '(No title)', start: startTime, end: endTime,
          location: event.location || null, allDay: event.start?.date ? 1 : 0, link: event.htmlLink || null });
      }
      pageToken = response.data.nextPageToken || undefined;
      if (!pageToken) break;
    }
    if (pageToken) throw new Error('Google Calendar has too many events for a bounded sync; existing events were preserved');

    const now = new Date().toISOString();
    return db.transaction(() => {
      const existing = db.prepare('SELECT id, source_id FROM calendar_events WHERE calendar_source_id = ?').all(source.id) as { id: string; source_id: string }[];
      const known = new Map(existing.map((event) => [event.source_id, event.id]));
      const result = { created: 0, updated: 0, deleted: 0 };
      for (const [externalId, event] of staged) {
        const localId = known.get(externalId);
        if (localId) {
          db.prepare(`UPDATE calendar_events SET title = ?, start_time = ?, end_time = ?, location = ?, is_all_day = ?, external_link = ? WHERE id = ?`)
            .run(event.title, event.start, event.end, event.location, event.allDay, event.link, localId);
          result.updated++;
        } else {
          db.prepare(`INSERT INTO calendar_events (id, workspace_id, source_id, calendar_source_id, title, start_time, end_time,
            location, is_all_day, external_link, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
            .run(uuidv4(), source.workspace_id, externalId, source.id, event.title, event.start, event.end,
              event.location, event.allDay, event.link, now);
          result.created++;
        }
      }
      for (const event of existing) {
        if (!staged.has(event.source_id)) {
          db.prepare('DELETE FROM calendar_events WHERE id = ?').run(event.id);
          result.deleted++;
        }
      }
      db.prepare('UPDATE calendar_sources SET last_synced_at = ?, last_sync_error = NULL, updated_at = ? WHERE id = ?').run(now, now, source.id);
      return result;
    })();
  } catch (error) {
    db.prepare('UPDATE calendar_sources SET last_sync_error = ? WHERE id = ?')
      .run(error instanceof Error ? error.message.slice(0, 300) : 'Google sync failed', source.id);
    throw error;
  }
}

export function disconnectGoogle(): void {
  const source = getGoogleSource();
  if (!source) return;
  const db = getDb();
  db.transaction(() => {
    db.prepare('DELETE FROM calendar_events WHERE calendar_source_id = ?').run(source.id);
    db.prepare('DELETE FROM calendar_sources WHERE id = ?').run(source.id);
  })();
}