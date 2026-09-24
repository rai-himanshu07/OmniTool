import { NextResponse } from 'next/server';
import { getDb, getSetting, setSetting } from '@/lib/db';
import { decryptServerSecret, encryptServerSecret } from '@/lib/services/serverCrypto';

interface AiConfig {
  base_url: string;
  model: string;
  api_key_enc?: string;
  api_key_iv?: string;
}

const CONFIG_KEY = 'ai_provider_config';

function loadConfig(): AiConfig | null {
  const raw = getSetting(CONFIG_KEY);
  return raw ? JSON.parse(raw) as AiConfig : null;
}

function validBaseUrl(input: string): string | null {
  try {
    const url = new URL(input);
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    if ((url.protocol !== 'https:' && !(url.protocol === 'http:' && local)) || url.username || url.password || url.search || url.hash) return null;
    return url.toString().replace(/\/$/, '');
  } catch {
    return null;
  }
}

export async function GET() {
  const config = loadConfig();
  return NextResponse.json({ configured: !!config, base_url: config?.base_url || '', model: config?.model || '', has_key: !!config?.api_key_enc });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const baseUrl = validBaseUrl(body.base_url);
    const model = typeof body.model === 'string' ? body.model.trim() : '';
    if (!baseUrl || !model || model.length > 200 || typeof body.api_key !== 'string') {
      return NextResponse.json({ error: 'Provide a valid HTTPS endpoint (or localhost HTTP), model and API key field' }, { status: 400 });
    }
    const previous = loadConfig();
    const secret = body.api_key.trim() ? encryptServerSecret(body.api_key.trim()) : null;
    const config: AiConfig = {
      base_url: baseUrl,
      model,
      api_key_enc: secret?.ciphertext || (previous?.base_url === baseUrl ? previous.api_key_enc : undefined),
      api_key_iv: secret?.iv || (previous?.base_url === baseUrl ? previous.api_key_iv : undefined),
    };
    setSetting(CONFIG_KEY, JSON.stringify(config));
    return NextResponse.json({ configured: true, base_url: baseUrl, model, has_key: !!config.api_key_enc });
  } catch {
    return NextResponse.json({ error: 'Could not save provider configuration' }, { status: 500 });
  }
}

export async function PUT() {
  try {
    const config = loadConfig();
    if (!config) return NextResponse.json({ error: 'Configure a provider first' }, { status: 400 });
    const headers: Record<string, string> = {};
    if (config.api_key_enc && config.api_key_iv) headers.Authorization = `Bearer ${decryptServerSecret(config.api_key_enc, config.api_key_iv)}`;
    const response = await fetch(`${config.base_url}/models`, {
      headers,
      redirect: 'error',
      signal: AbortSignal.timeout(8000),
      cache: 'no-store',
    });
    return response.ok
      ? NextResponse.json({ connected: true })
      : NextResponse.json({ connected: false, error: `Provider returned HTTP ${response.status}` }, { status: 502 });
  } catch {
    return NextResponse.json({ connected: false, error: 'Provider could not be reached' }, { status: 502 });
  }
}

export async function DELETE() {
  getDb().prepare('DELETE FROM settings WHERE key = ?').run(CONFIG_KEY);
  return NextResponse.json({ configured: false });
}