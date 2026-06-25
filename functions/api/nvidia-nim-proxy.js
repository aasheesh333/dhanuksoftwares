import { corsHeaders } from '../../lib/auth.mjs';

const ALLOWED_ORIGINS = ['https://dhanuksoftwares.com', 'https://www.dhanuksoftwares.com', 'https://dhanuksoftwares.pages.dev'];
const NIM_BASE = 'https://integrate.api.nvidia.com/v1';
const RATE_LIMIT_MAP = new Map();
const RATE_LIMIT = 20;
const RATE_WINDOW = 60_000;

function checkRate(ip) {
  const now = Date.now();
  const record = RATE_LIMIT_MAP.get(ip) || { count: 0, resetAt: now + RATE_WINDOW };
  if (now > record.resetAt) {
    record.count = 0;
    record.resetAt = now + RATE_WINDOW;
  }
  if (record.count >= RATE_LIMIT) return false;
  record.count++;
  RATE_LIMIT_MAP.set(ip, record);
  return true;
}

export async function onRequest({ request }) {
  const requestOrigin = request.headers.get('origin') || '';
  const headers = corsHeaders(requestOrigin, ALLOWED_ORIGINS);

  if (request.method === 'OPTIONS') return new Response('', { status: 200, headers });

  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown';
    if (!checkRate(ip)) {
      return new Response(JSON.stringify({ error: 'Rate limit exceeded. Try again in a minute.' }), { status: 429, headers });
    }

    const url = new URL(request.url);
    const nimAction = url.searchParams.get('action');
    const apiKey = request.headers.get('x-nvidia-api-key');

    if (!apiKey || !apiKey.startsWith('nvapi-')) {
      return new Response(JSON.stringify({ error: 'Invalid or missing NVIDIA API key. Key must start with nvapi-' }), { status: 401, headers });
    }

    const fetchOptions = {
      method: request.method === 'POST' ? 'POST' : 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    };

    if (request.method === 'POST') {
      const body = await request.text();
      fetchOptions.body = body;
    }

    let nimUrl;

    if (nimAction === 'models') {
      nimUrl = `${NIM_BASE}/models`;
    } else if (nimAction === 'chat') {
      nimUrl = `${NIM_BASE}/chat/completions`;
    } else if (nimAction === 'completions') {
      nimUrl = `${NIM_BASE}/completions`;
    } else {
      return new Response(JSON.stringify({ error: 'Invalid action. Use: models, chat, completions' }), { status: 400, headers });
    }

    const startTime = Date.now();
    const nimRes = await fetch(nimUrl, fetchOptions);
    const elapsed = Date.now() - startTime;

    const responseHeaders = { ...headers };
    responseHeaders['x-nim-latency-ms'] = String(elapsed);

    const contentType = nimRes.headers.get('content-type') || '';

    if (!nimRes.ok) {
      const errText = await nimRes.text().catch(() => 'Unknown error');
      return new Response(JSON.stringify({
        error: `NVIDIA NIM API error: ${nimRes.status}`,
        detail: errText.slice(0, 500),
        latencyMs: elapsed,
      }), { status: nimRes.status, headers: responseHeaders });
    }

    if (contentType.includes('text/event-stream')) {
      return new Response(nimRes.body, {
        status: 200,
        headers: {
          ...responseHeaders,
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    }

    const data = await nimRes.json();
    return new Response(JSON.stringify({ ...data, _latencyMs: elapsed }), { status: 200, headers: responseHeaders });

  } catch (e) {
    return new Response(JSON.stringify({ error: 'Proxy error', detail: e.message }), { status: 500, headers });
  }
}
