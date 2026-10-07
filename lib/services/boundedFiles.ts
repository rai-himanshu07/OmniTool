import yauzl from 'yauzl';
import { AccessError } from './workspaceAccess';

export async function boundedFormData(request: Request, limit: number) {
  if (!request.body || Number(request.headers.get('content-length')) > limit) throw new AccessError('Upload exceeds the size limit', 413);
  const reader = request.body.getReader(); const chunks: Uint8Array[] = []; let size = 0;
  try {
    for (;;) { const result = await reader.read(); if (result.done) break; size += result.value.length; if (size > limit) throw new AccessError('Upload exceeds the size limit', 413); chunks.push(result.value); }
  } finally { await reader.cancel(); }
  return new Response(Buffer.concat(chunks), { headers: { 'Content-Type': request.headers.get('content-type') || '' } }).formData();
}

export function inspectZip(buffer: Buffer, limit = 50 * 1024 * 1024, allowed?: string[]): Promise<Map<string, Buffer>> {
  return new Promise((resolve, reject) => {
    yauzl.fromBuffer(buffer, { lazyEntries: true, validateEntrySizes: true }, (error, zip) => {
      if (error || !zip) { reject(new AccessError('Invalid ZIP archive')); return; }
      let count = 0; let total = 0; let finished = false;
      const entries = new Map<string, Buffer>(); const names = new Set<string>();
      const fail = (cause: unknown) => { if (finished) return; finished = true; zip.close(); reject(cause); };
      zip.on('error', fail);
      zip.on('end', () => { if (!finished) { finished = true; resolve(entries); } });
      zip.on('entry', (entry: yauzl.Entry) => {
        total += entry.uncompressedSize; count++;
        if (count > (allowed ? 10 : 3000) || total > limit || entry.generalPurposeBitFlag & 1 || entry.fileName.startsWith('/') || entry.fileName.includes('\\') || entry.fileName.split('/').includes('..') || names.has(entry.fileName)) { fail(new AccessError('Archive is encrypted, duplicated, unsafe, or exceeds expansion limits')); return; }
        names.add(entry.fileName);
        if (allowed && !allowed.includes(entry.fileName)) { fail(new AccessError('Unexpected backup archive entry')); return; }
        zip.openReadStream(entry, (streamError, stream) => {
          if (streamError || !stream) { fail(new AccessError('Cannot read archive entry')); return; }
          const chunks: Buffer[] = []; let actual = 0;
          stream.on('error', fail);
          stream.on('data', (chunk: Buffer) => { actual += chunk.length; if (actual > entry.uncompressedSize || actual > limit) { stream.destroy(); fail(new AccessError('Archive expansion limit exceeded')); } else if (allowed) chunks.push(chunk); });
          stream.on('end', () => { if (!finished) { if (actual !== entry.uncompressedSize) { fail(new AccessError('Archive size metadata mismatch')); return; } entries.set(entry.fileName, allowed ? Buffer.concat(chunks) : Buffer.alloc(0)); zip.readEntry(); } });
        });
      });
      zip.readEntry();
    });
  });
}