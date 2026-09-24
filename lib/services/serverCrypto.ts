// Server-side (Node crypto) AES-256-GCM encryption for secrets that must be
// decryptable by the server itself (e.g. Microsoft Graph tokens) — distinct
// from vaultCrypto.ts, which is zero-knowledge client-side encryption the
// server can never decrypt. The key lives in a local, gitignored file next to
// the database, generated on first use.
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const DB_PATH = process.env.DATABASE_PATH || path.join(process.cwd(), 'omnitool.db');
const SECRET_PATH = process.env.OMNITOOL_SECRET_PATH || path.join(path.dirname(DB_PATH), '.omnitool_secret');

let cachedKey: Buffer | null = null;

function loadOrCreateServerSecret(): Buffer {
  if (fs.existsSync(SECRET_PATH)) {
    const hex = fs.readFileSync(SECRET_PATH, 'utf8').trim();
    if (!/^[0-9a-f]{64}$/i.test(hex)) throw new Error('Invalid server secret file');
    return Buffer.from(hex, 'hex');
  }

  const secret = crypto.randomBytes(32);
  const dir = path.dirname(SECRET_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(SECRET_PATH, secret.toString('hex'), { mode: 0o600, flag: 'wx' });
  return secret;
}

function getServerKey(): Buffer {
  if (!cachedKey) cachedKey = loadOrCreateServerSecret();
  return cachedKey;
}

export function getAuthSecret(): string {
  return crypto.createHmac('sha256', getServerKey()).update('omnitool-auth-v1').digest('hex');
}

export function encryptServerSecret(plaintext: string): { ciphertext: string; iv: string } {
  const key = getServerKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return {
    ciphertext: Buffer.concat([encrypted, authTag]).toString('hex'),
    iv: iv.toString('hex'),
  };
}

export function decryptServerSecret(ciphertextHex: string, ivHex: string): string {
  const key = getServerKey();
  const iv = Buffer.from(ivHex, 'hex');
  const combined = Buffer.from(ciphertextHex, 'hex');
  const authTag = combined.subarray(combined.length - 16);
  const encrypted = combined.subarray(0, combined.length - 16);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString('utf8');
}
