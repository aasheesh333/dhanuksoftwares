import { corsHeaders } from '../../lib/auth.mjs';

const ALLOWED_ORIGINS = ['https://dhanuksoftwares.com', 'https://www.dhanuksoftwares.com'];
const rateLimitMap = new Map();
const RATE_LIMIT = 30;
const RATE_WINDOW = 60_000;

function checkRate(ip) {
  const now = Date.now();
  const record = rateLimitMap.get(ip) || { count: 0, resetAt: now + RATE_WINDOW };
  if (now > record.resetAt) {
    record.count = 0;
    record.resetAt = now + RATE_WINDOW;
  }
  if (record.count >= RATE_LIMIT) return false;
  record.count++;
  rateLimitMap.set(ip, record);
  return true;
}

export async function onRequest({ request }) {
  const requestOrigin = request.headers.get('origin') || '';
  const headers = corsHeaders(requestOrigin, ALLOWED_ORIGINS);

  if (request.method === 'OPTIONS') return new Response('', { status: 200, headers });
  if (request.method !== 'POST') return new Response('', { status: 200, headers });

  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown';
    if (!checkRate(ip)) {
      return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), { status: 429, headers });
    }
    const body = await request.json().catch(() => ({}));
    const { app, marketplace, source } = body;
    const safeApp = String(app || '').slice(0, 80).replace(/[^\w.\-]/g, '');
    const safeMp = String(marketplace || '').slice(0, 40).replace(/[^\w.\-]/g, '');
    const safeSrc = String(source || '').slice(0, 40).replace(/[^\w.\-]/g, '');
    const ua = request.headers.get('user-agent') || '';
    const ts = new Date().toISOString();
    console.log(`[DOWNLOAD] ${ts} app=${safeApp} mp=${safeMp} src=${safeSrc} ip=${ip} ua="${ua.slice(0, 80)}"`);
  } catch (e) {
  }

  return new Response(null, { status: 200, headers });
}
