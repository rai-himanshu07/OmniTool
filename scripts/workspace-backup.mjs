import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';

const command = process.argv[2];
const source = path.resolve(process.env.DATABASE_PATH || 'omnitool.db');
const secret = path.resolve(process.env.OMNITOOL_SECRET_PATH || path.join(path.dirname(source), '.omnitool_secret'));
const digest = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

function checkDatabase(file) {
  const db = new Database(file, { readonly: true, fileMustExist: true });
  try {
    if (db.pragma('integrity_check', { simple: true }) !== 'ok') throw new Error('SQLite integrity check failed');
    if (db.pragma('foreign_key_check').length) throw new Error('SQLite foreign key check failed');
    const tables = new Set(db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map((row) => row.name));
    for (const name of ['workspaces', 'tasks', 'settings', 'secure_notes', 'notebook_pages']) {
      if (!tables.has(name)) throw new Error('Missing workspace table');
    }
    const calendarSecrets = tables.has('calendar_sources') && !!db.prepare('SELECT 1 FROM calendar_sources WHERE client_secret_enc IS NOT NULL LIMIT 1').get();
    const aiConfig = db.prepare("SELECT value FROM settings WHERE key = 'ai_provider_config'").get();
    const aiSecret = aiConfig && !!JSON.parse(aiConfig.value).api_key_enc;
    return calendarSecrets || aiSecret;
  } finally { db.close(); }
}

function verify(directory) {
  const manifest = JSON.parse(fs.readFileSync(path.join(directory, 'manifest.json'), 'utf8'));
  if (manifest.format !== 'omnitool-backup-v1' || !manifest.files || !manifest.files['workspace.db']) throw new Error('Unsupported backup format');
  for (const [name, expected] of Object.entries(manifest.files)) {
    if (!['workspace.db', 'server-secret'].includes(name) || !/^[a-f0-9]{64}$/.test(expected)) throw new Error('Invalid backup manifest');
    if (digest(path.join(directory, name)) !== expected) throw new Error('Backup checksum mismatch');
  }
  if (checkDatabase(path.join(directory, 'workspace.db')) && !manifest.files['server-secret']) throw new Error('Encrypted credentials require the server secret');
  return manifest;
}

async function backup(destination) {
  if (!destination || fs.existsSync(destination)) throw new Error('Provide a new, empty backup directory');
  if (!fs.existsSync(source)) throw new Error('Workspace database not found');
  const db = new Database(source, { readonly: true, fileMustExist: true });
  fs.mkdirSync(destination, { recursive: true, mode: 0o700 });
  try {
    await db.backup(path.join(destination, 'workspace.db'));
    fs.chmodSync(path.join(destination, 'workspace.db'), 0o600);
    const files = { 'workspace.db': digest(path.join(destination, 'workspace.db')) };
    if (fs.existsSync(secret)) {
      const value = fs.readFileSync(secret, 'utf8').trim();
      if (!/^[a-f0-9]{64}$/i.test(value)) throw new Error('Server secret is invalid');
      fs.copyFileSync(secret, path.join(destination, 'server-secret'), fs.constants.COPYFILE_EXCL);
      fs.chmodSync(path.join(destination, 'server-secret'), 0o600);
      files['server-secret'] = digest(path.join(destination, 'server-secret'));
    }
    if (checkDatabase(path.join(destination, 'workspace.db')) && !files['server-secret']) throw new Error('Server secret missing for encrypted credentials');
    fs.writeFileSync(path.join(destination, 'manifest.json'), JSON.stringify({ format: 'omnitool-backup-v1', created_at: new Date().toISOString(), files }), { mode: 0o600, flag: 'wx' });
    verify(destination);
    console.log('Verified backup created. Treat the directory as sensitive.');
  } catch (error) {
    fs.rmSync(destination, { recursive: true, force: true });
    throw error;
  } finally { db.close(); }
}

function restore(directory, destination) {
  if (!directory || !destination) throw new Error('Provide a backup directory and new destination database path');
  const resolved = path.resolve(destination);
  if (fs.existsSync(resolved) || fs.existsSync(`${resolved}-wal`) || fs.existsSync(`${resolved}-shm`)) throw new Error('Destination exists; restore never overwrites');
  const manifest = verify(path.resolve(directory));
  const targetSecret = path.join(path.dirname(resolved), '.omnitool_secret');
  if (manifest.files['server-secret'] && fs.existsSync(targetSecret)) throw new Error('Destination server secret exists; choose a fresh directory');
  fs.mkdirSync(path.dirname(resolved), { recursive: true, mode: 0o700 });
  let copiedSecret = false;
  try {
    fs.copyFileSync(path.join(directory, 'workspace.db'), resolved, fs.constants.COPYFILE_EXCL);
    fs.chmodSync(resolved, 0o600);
    if (manifest.files['server-secret']) {
      fs.copyFileSync(path.join(directory, 'server-secret'), targetSecret, fs.constants.COPYFILE_EXCL);
      copiedSecret = true;
      fs.chmodSync(targetSecret, 0o600);
    }
    checkDatabase(resolved);
    console.log('Verified restore created at a new destination. Set DATABASE_PATH to use it.');
  } catch (error) {
    fs.rmSync(resolved, { force: true });
    if (copiedSecret) fs.rmSync(targetSecret, { force: true });
    throw error;
  }
}

try {
  if (command === 'backup') await backup(process.argv[3] && path.resolve(process.argv[3]));
  else if (command === 'verify') { verify(path.resolve(process.argv[3] || '')); console.log('Backup verified.'); }
  else if (command === 'restore') restore(process.argv[3], process.argv[4]);
  else throw new Error('Usage: npm run backup -- <new directory> | npm run backup:verify -- <directory> | npm run backup:restore -- <directory> <new database path>');
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}