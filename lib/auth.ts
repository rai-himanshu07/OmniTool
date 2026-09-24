import crypto from 'node:crypto';
import { betterAuth } from 'better-auth';
import { APIError, createAuthMiddleware } from 'better-auth/api';
import { getMigrations } from 'better-auth/db/migration';
import { getDb, getDefaultWorkspaceId } from './db';
import { getAuthSecret } from './services/serverCrypto';

const db = getDb();
const baseURL = process.env.BETTER_AUTH_URL || 'http://127.0.0.1:3000';
const tokenHash = (token: string) => crypto.createHash('sha256').update(token).digest('hex');

export const auth = betterAuth({
  database: db,
  baseURL,
  secret: getAuthSecret(),
  emailAndPassword: { enabled: true, minPasswordLength: 12 },
  session: { expiresIn: 60 * 60 * 24 * 7, updateAge: 60 * 60 * 24 },
  rateLimit: { enabled: true },
  hooks: {
    before: createAuthMiddleware(async (context) => {
      if (context.path !== '/sign-up/email') return;
      const users = db.prepare('SELECT COUNT(*) AS count FROM user').get() as { count: number };
      if (users.count === 0) return;
      const invitationToken = context.headers?.get('x-omnitool-invite');
      if (!invitationToken || !context.body?.email || typeof context.body.email !== 'string') {
        throw new APIError('FORBIDDEN', { message: 'An invitation is required' });
      }
      const invitation = db.prepare(`SELECT id FROM account_invitations WHERE token_hash = ? AND lower(email) = lower(?)
        AND accepted_at IS NULL AND expires_at > ?`).get(tokenHash(invitationToken), context.body.email, new Date().toISOString());
      if (!invitation) throw new APIError('FORBIDDEN', { message: 'Invalid or expired invitation' });
    }),
  },
  databaseHooks: {
    user: { create: { after: async (user) => {
      const now = new Date().toISOString();
      const userCount = (db.prepare('SELECT COUNT(*) AS count FROM user').get() as { count: number }).count;
      const invitation = userCount === 1 ? undefined : db.prepare(`SELECT * FROM account_invitations
        WHERE lower(email) = lower(?) AND accepted_at IS NULL AND expires_at > ? ORDER BY created_at DESC LIMIT 1`)
        .get(user.email, now) as { id: string; role: string; person_id: string | null } | undefined;
      if (userCount !== 1 && !invitation) throw new APIError('FORBIDDEN', { message: 'An invitation is required' });
      db.transaction(() => {
        db.prepare(`INSERT INTO account_roles (user_id, workspace_id, role, person_id, created_at) VALUES (?, ?, ?, ?, ?)`)
          .run(user.id, getDefaultWorkspaceId(), userCount === 1 ? 'admin' : invitation!.role, invitation?.person_id || null, now);
        if (userCount === 1) {
          const salt = db.prepare("SELECT value FROM settings WHERE key = 'screen_lock_salt'").get() as { value: string } | undefined;
          const hash = db.prepare("SELECT value FROM settings WHERE key = 'screen_lock_hash'").get() as { value: string } | undefined;
          if (salt && hash) {
            db.prepare('INSERT INTO screen_lock_settings (user_id, salt, hash) VALUES (?, ?, ?)').run(user.id, salt.value, hash.value);
            db.prepare("DELETE FROM settings WHERE key IN ('screen_lock_salt', 'screen_lock_hash')").run();
          }
        }
        if (invitation) db.prepare('UPDATE account_invitations SET accepted_at = ? WHERE id = ?').run(now, invitation.id);
      })();
    } } },
  },
});

export const authReady = getMigrations(auth.options).then(({ runMigrations }) => runMigrations());