// Shared auth helpers — works in both Node (build) and Cloudflare Workers/Pages Functions.
// Uses Web Crypto API which is available in both runtimes.

export async function createSessionToken(secret, ttlMs = 24 * 60 * 60 * 1000) {
  const ts = (Date.now() + ttlMs).toString(36);
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(ts));
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${ts}.${sigB64}`;
}

export async function verifySessionToken(token, secret) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return false;
  const dot = token.indexOf('.');
  const ts = token.slice(0, dot);
  const sigB64 = token.slice(dot + 1);
  const tsNum = parseInt(ts, 36);
  if (!Number.isFinite(tsNum) || tsNum <= 0) return false;
  if (Date.now() > tsNum) return false;
  let sigBytes;
  try {
    const padded = sigB64.replace(/-/g, '+').replace(/_/g, '/');
    const bin = atob(padded + '==='.slice((padded.length + 3) % 4));
    sigBytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) sigBytes[i] = bin.charCodeAt(i);
  } catch (e) { return false; }
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  );
  return await crypto.subtle.verify('HMAC', key, sigBytes, enc.encode(ts));
}

export function getCookieValue(req, name) {
  const cookies = req.headers.get('Cookie') || '';
  const re = new RegExp('(?:^|;\\s*)' + name + '=([^;]+)');
  const m = cookies.match(re);
  return m ? decodeURIComponent(m[1]) : null;
}

export function corsHeaders(origin, allowedOrigins) {
  const allowOrigin = allowedOrigins.includes(origin) ? origin : allowedOrigins[0];
  return {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': 'Content-Type, x-admin-token, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Credentials': 'true',
    'Vary': 'Origin'
  };
}

// Returns true if request is authenticated: either session token (cookie OR Authorization) OR legacy password.
export async function isAuthed(req, env) {
  const ADMIN_PASSWORD = env.ADMIN_PASSWORD;
  if (!ADMIN_PASSWORD) return false;

  // Legacy: x-admin-token equals the password directly (for curl/scripts)
  const headerToken = req.headers.get('x-admin-token');
  if (headerToken && headerToken === ADMIN_PASSWORD) return true;

  // Authorization: Bearer <session-token>
  const auth = req.headers.get('Authorization') || '';
  if (auth.startsWith('Bearer ')) {
    const t = auth.slice(7).trim();
    if (await verifySessionToken(t, ADMIN_PASSWORD)) return true;
  }

  // x-admin-token can also carry a session token
  if (headerToken && headerToken !== ADMIN_PASSWORD && await verifySessionToken(headerToken, ADMIN_PASSWORD)) return true;

  // Cookie
  const cookieToken = getCookieValue(req, 'ds_session');
  if (cookieToken && await verifySessionToken(cookieToken, ADMIN_PASSWORD)) return true;

  return false;
}
