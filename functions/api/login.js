import { createSessionToken, corsHeaders } from '../../lib/auth.mjs';

const ALLOWED_ORIGINS = ['https://dhanuksoftwares.com', 'https://www.dhanuksoftwares.com'];
const COOKIE_NAME = 'ds_session';
const COOKIE_MAX_AGE = 24 * 60 * 60;

export async function onRequest({ request, env }) {
  const origin = request.headers.get('origin') || '';
  const headers = corsHeaders(origin, ALLOWED_ORIGINS);

  if (request.method === 'OPTIONS') return new Response('', { status: 200, headers });
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers });
  }

  const ADMIN_PASSWORD = env.ADMIN_PASSWORD;
  if (!ADMIN_PASSWORD) {
    return new Response(JSON.stringify({ error: 'Admin password not configured' }), { status: 500, headers });
  }

  let body;
  try { body = await request.json(); } catch (e) {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400, headers });
  }

  const { password } = body;
  if (!password || typeof password !== 'string') {
    return new Response(JSON.stringify({ error: 'Password required' }), { status: 400, headers });
  }

  // Constant-time comparison
  if (!safeEqual(password, ADMIN_PASSWORD)) {
    await new Promise(r => setTimeout(r, 250 + Math.random() * 250));
    return new Response(JSON.stringify({ error: 'Invalid password' }), { status: 401, headers });
  }

  const token = await createSessionToken(ADMIN_PASSWORD);
  return new Response(JSON.stringify({ ok: true, token, expiresInSeconds: COOKIE_MAX_AGE }), {
    status: 200,
    headers: {
      ...headers,
      'Set-Cookie': `${COOKIE_NAME}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${COOKIE_MAX_AGE}`
    }
  });
}

function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const len = Math.max(a.length, b.length, 1);
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0 && a.length === b.length;
}
