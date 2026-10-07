import path from 'node:path';
import fs from 'node:fs';
import Database from 'better-sqlite3';
import password from '@inquirer/password';
import { hashPassword } from 'better-auth/crypto';

const email = process.argv[2];
if (!email || !process.stdin.isTTY) {
  console.error('Run npm run account:reset -- <email> in an interactive host terminal. Passwords are never accepted as command arguments.');
  process.exitCode = 1;
} else {
  const file = path.resolve(process.env.DATABASE_PATH || 'omnitool.db');
  if (!fs.existsSync(file)) throw new Error('Workspace database not found');
  const db = new Database(file, { fileMustExist: true });
  try {
    const user = db.prepare('SELECT id FROM user WHERE lower(email) = lower(?)').get(email);
    if (!user || !db.prepare("SELECT id FROM account WHERE userId = ? AND providerId = 'credential'").get(user.id)) throw new Error('Local account not found');
    const newPassword = await password({ message: 'New account password (12-128 characters)', validate: (value) => value.length >= 12 && value.length <= 128 || 'Use 12-128 characters' });
    const confirmation = await password({ message: 'Confirm new account password' });
    if (newPassword !== confirmation) throw new Error('Passwords do not match');
    const hash = await hashPassword(newPassword);
    db.transaction(() => {
      db.prepare("UPDATE account SET password = ?, updatedAt = ? WHERE userId = ? AND providerId = 'credential'").run(hash, new Date().toISOString(), user.id);
      db.prepare('DELETE FROM session WHERE userId = ?').run(user.id);
    })();
    console.log('Account password reset; existing sessions revoked. Vault encryption and PIN are unchanged.');
  } catch (error) { console.error(error.message); process.exitCode = 1; }
  finally { db.close(); }
}