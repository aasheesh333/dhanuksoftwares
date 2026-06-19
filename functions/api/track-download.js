export async function onRequest({ request }) {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  if (request.method === 'OPTIONS') return new Response('', { status: 200, headers });
  if (request.method !== 'POST') return new Response('', { status: 200, headers });

  try {
    const body = await request.json().catch(() => ({}));
    const { app, marketplace, source } = body;
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown';
    const ua = request.headers.get('user-agent') || '';
    const ts = new Date().toISOString();
    console.log(`[DOWNLOAD] ${ts} app=${app} mp=${marketplace} src=${source} ip=${ip} ua="${ua.slice(0, 80)}"`);
  } catch (e) {
  }

  return new Response(null, { status: 200, headers });
}