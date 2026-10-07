import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { ZipArchive } from 'archiver';
import { getDb, getSetting, setSetting } from '@/lib/db';
import { AccessError, apiError, getAccess, reauthenticate } from '@/lib/services/workspaceAccess';
import { boundedFormData, inspectZip } from '@/lib/services/boundedFiles';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const run = promisify(execFile);
const root = () => path.join(path.dirname(path.resolve(process.env.DATABASE_PATH || 'omnitool.db')), '.omnitool-recovery');
const cli = (...args: string[]) => run(process.execPath, [path.join(process.cwd(), 'scripts/workspace-backup.mjs'), ...args], { maxBuffer: 1024 * 1024 });

export async function GET(request: Request) {
  try {
    await getAccess(request, ['admin']);
    const rows = await fs.readdir(root(), { withFileTypes: true }).catch(() => []);
    const backups = [];
    for (const row of rows.filter((entry) => entry.isDirectory() && /^[a-f0-9-]{36}$/.test(entry.name))) {
      const manifest = await fs.readFile(path.join(root(), row.name, 'manifest.json'), 'utf8').then((value) => JSON.parse(value)).catch(() => null);
      if (manifest) backups.push({ id: row.name, created_at: manifest.created_at });
    }
    return NextResponse.json({ backups: backups.sort((first, second) => second.created_at.localeCompare(first.created_at)), last_created: getSetting('backup_last_created'), last_verified: getSetting('backup_last_verified'), retention_days: Number(getSetting('trash_retention_days')) || 30 });
  } catch (error) { return apiError(error); }
}

export async function POST(request: Request) {
  let temporary = '';
  try {
    await getAccess(request, ['admin']);
    const multipart = request.headers.get('content-type')?.startsWith('multipart/form-data');
    const form = multipart ? await boundedFormData(request, 105 * 1024 * 1024) : null;
    const body = form ? { action: form.get('action'), password: form.get('password') } : await request.json();
    await reauthenticate(request, body.password);
    await fs.mkdir(root(), { recursive: true, mode: 0o700 });
    if (body.action === 'retention') {
      if (!Number.isInteger(body.days) || body.days < 1 || body.days > 365) throw new AccessError('Retention must be 1-365 days');
      setSetting('trash_retention_days', String(body.days)); return NextResponse.json({ success: true });
    }
    if (body.action === 'create') {
      getDb(); const id = randomUUID(); await cli('backup', path.join(root(), id));
      setSetting('backup_last_created', new Date().toISOString()); setSetting('backup_last_verified', new Date().toISOString());
      return NextResponse.json({ id, success: true });
    }
    if (body.action === 'verify' || body.action === 'download') {
      if (typeof body.id !== 'string' || !/^[a-f0-9-]{36}$/.test(body.id)) throw new AccessError('Invalid backup');
      const directory = path.join(root(), body.id); await cli('verify', directory); setSetting('backup_last_verified', new Date().toISOString());
      if (body.action === 'verify') return NextResponse.json({ success: true });
      const manifest = JSON.parse(await fs.readFile(path.join(directory, 'manifest.json'), 'utf8'));
      const archive = new ZipArchive({ zlib: { level: 6 } }); const chunks: Buffer[] = []; let size = 0;
      const result = new Promise<Buffer>((resolve, reject) => { archive.on('data', (chunk: Buffer) => { size += chunk.length; if (size > 100 * 1024 * 1024) { archive.abort(); reject(new AccessError('Backup is too large for browser download. Use the CLI.')); } else chunks.push(chunk); }); archive.on('error', reject); archive.on('end', () => resolve(Buffer.concat(chunks))); });
      for (const name of ['manifest.json', ...Object.keys(manifest.files)]) archive.file(path.join(directory, name), { name });
      await archive.finalize();
      return new NextResponse(new Uint8Array(await result), { headers: { 'Content-Type': 'application/zip', 'Content-Disposition': `attachment; filename="omnitool-backup-${body.id}.zip"`, 'Cache-Control': 'no-store' } });
    }
    if (form && ['inspect', 'stage'].includes(String(body.action))) {
      const file = form.get('file'); if (!(file instanceof File) || !file.size || file.size > 100 * 1024 * 1024) throw new AccessError('Choose a backup ZIP under 100 MB');
      const files = await inspectZip(Buffer.from(await file.arrayBuffer()), 200 * 1024 * 1024, ['manifest.json', 'workspace.db', 'server-secret']);
      if (!files.has('manifest.json') || !files.has('workspace.db')) throw new AccessError('Incomplete backup');
      temporary = path.join(root(), `upload-${randomUUID()}`); await fs.mkdir(temporary, { mode: 0o700 });
      for (const [name, content] of files) await fs.writeFile(path.join(temporary, name), content, { mode: 0o600, flag: 'wx' });
      await cli('verify', temporary);
      if (body.action === 'inspect') return NextResponse.json({ verified: true, created_at: JSON.parse(files.get('manifest.json')!.toString()).created_at });
      const destination = path.join(root(), `restore-${randomUUID()}`, 'omnitool.db'); await cli('restore', temporary, destination);
      return NextResponse.json({ verified: true, destination, secret_path: path.join(path.dirname(destination), '.omnitool_secret'), instructions: 'Stop the server, set DATABASE_PATH and OMNITOOL_SECRET_PATH to these restored paths, then restart. The active database has not been changed.' });
    }
    throw new AccessError('Invalid backup action');
  } catch (error) { return apiError(error instanceof AccessError ? error : new AccessError('Backup could not be verified or prepared. The live database was not replaced.')); }
  finally { if (temporary) await fs.rm(temporary, { recursive: true, force: true }); }
}