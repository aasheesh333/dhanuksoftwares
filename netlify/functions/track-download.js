export default async (req) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  if (req.method === 'OPTIONS') return new Response('', { status: 204, headers });
  if (req.method !== 'POST') return new Response('', { status: 204, headers });

  try {
    const body = await req.json().catch(() => ({}));
    const { app, marketplace, source } = body;
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown';
    const ua = req.headers.get('user-agent') || '';
    const ts = new Date().toISOString();
    console.log(`[DOWNLOAD] ${ts} app=${app} mp=${marketplace} src=${source} ip=${ip} ua="${ua.slice(0, 80)}"`);
  } catch (e) {
    // ignore
  }

  return new Response('', { status: 204, headers });
};

export const config = { path: '/api/track-download' };
