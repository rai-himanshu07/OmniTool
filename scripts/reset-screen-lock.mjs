import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';

const databasePath = process.env.DATABASE_PATH || path.join(process.cwd(), 'omnitool.db');
const accountEmail = process.argv[2];
if (!fs.existsSync(databasePath)) {
  console.error('Workspace database not found. No changes made.');
  process.exitCode = 1;
} else {
  const db = new Database(databasePath, { fileMustExist: true });
  try {
    const authTables = !!db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'user'").get();
    if (authTables) {
      const users = db.prepare('SELECT COUNT(*) AS count FROM user').get().count;
      if (users > 1 && !accountEmail) throw new Error('Specify account email: npm run lock:reset -- user@example.com');
      const account = accountEmail ? db.prepare('SELECT id FROM user WHERE lower(email) = lower(?)').get(accountEmail) : db.prepare('SELECT id FROM user LIMIT 1').get();
      if (users && !account) throw new Error('Account not found. No changes made.');
      if (account) db.prepare('DELETE FROM screen_lock_settings WHERE user_id = ?').run(account.id);
    }
    db.prepare("DELETE FROM settings WHERE key IN ('screen_lock_hash', 'screen_lock_salt')").run();
    console.log('Screen lock reset for the selected account. Other workspace data was not changed.');
  } finally {
    db.close();
  }
}