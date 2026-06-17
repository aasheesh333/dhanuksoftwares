const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Dhanuk@2025';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_REPO = process.env.GITHUB_REPO || 'aasheesh333/dhanuksoftwares';
const GITHUB_BRANCH = process.env.GITHUB_BRANCH || 'main';

export default async (req) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, x-admin-token',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  if (req.method === 'OPTIONS') return new Response('', { status: 204, headers });
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers });

  const token = req.headers.get('x-admin-token');
  if (token !== ADMIN_PASSWORD) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers });
  }

  if (!GITHUB_TOKEN) {
    return new Response(JSON.stringify({ error: 'GITHUB_TOKEN not configured. Add it in Netlify env vars.' }), { status: 500, headers });
  }

  let body;
  try { body = await req.json(); } catch (e) {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400, headers });
  }

  const apps = body.apps;
  if (!Array.isArray(apps)) {
    return new Response(JSON.stringify({ error: 'apps[] required' }), { status: 400, headers });
  }

  const content = JSON.stringify(apps, null, 2);
  const contentBase64 = Buffer.from(content).toString('base64');
  const message = `chore: update apps.json (${apps.length} apps) via admin [${new Date().toISOString()}]`;

  try {
    const getRes = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/contents/apps.json?ref=${GITHUB_BRANCH}`, {
      headers: {
        'Authorization': `Bearer ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github+json',
        'User-Agent': 'dhanuksoftwares-admin'
      }
    });

    let sha;
    if (getRes.ok) {
      const file = await getRes.json();
      sha = file.sha;
    } else if (getRes.status !== 404) {
      const err = await getRes.text();
      return new Response(JSON.stringify({ error: `GitHub GET failed: ${getRes.status}`, details: err.slice(0, 200) }), { status: 502, headers });
    }

    const putRes = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/contents/apps.json`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github+json',
        'Content-Type': 'application/json',
        'User-Agent': 'dhanuksoftwares-admin'
      },
      body: JSON.stringify({
        message,
        content: contentBase64,
        branch: GITHUB_BRANCH,
        ...(sha ? { sha } : {})
      })
    });

    if (!putRes.ok) {
      const err = await putRes.text();
      return new Response(JSON.stringify({ error: `GitHub PUT failed: ${putRes.status}`, details: err.slice(0, 200) }), { status: 502, headers });
    }

    const result = await putRes.json();

    return new Response(JSON.stringify({
      ok: true,
      commitSha: result.commit.sha,
      commitUrl: result.commit.html_url,
      appsCount: apps.length
    }), { status: 200, headers });
  } catch (e) {
    return new Response(JSON.stringify({ error: `Server error: ${e.message}` }), { status: 500, headers });
  }
};

export const config = { path: '/api/publish' };
