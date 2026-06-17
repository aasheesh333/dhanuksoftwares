const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Dhanuk@2025';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_REPO = process.env.GITHUB_REPO || 'aasheesh333/dhanuksoftwares';
const GITHUB_BRANCH = process.env.GITHUB_BRANCH || 'main';
const NETLIFY_SITE_ID = process.env.NETLIFY_SITE_ID || '340e532b-30a2-4038-8cb9-3e36eb82b1a9';
const NETLIFY_API_TOKEN = process.env.NETLIFY_API_TOKEN;
const NETLIFY_BUILD_HOOK = process.env.NETLIFY_BUILD_HOOK || 'https://api.netlify.com/build_hooks/6a32c8a697ea6925f013e638';

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

    let buildTriggered = false;
    let buildMethod = 'none';
    if (NETLIFY_API_TOKEN) {
      try {
        const deployRes = await fetch(`https://api.netlify.com/api/v1/sites/${NETLIFY_SITE_ID}/deploys`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${NETLIFY_API_TOKEN}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ title: `apps.json auto-deploy (${apps.length} apps)` })
        });
        if (deployRes.ok) {
          buildTriggered = true;
          buildMethod = 'api';
        }
      } catch (e) {
        console.log('Netlify API deploy failed:', e.message);
      }
    }
    if (!buildTriggered && NETLIFY_BUILD_HOOK) {
      try {
        const hookRes = await fetch(NETLIFY_BUILD_HOOK, { method: 'POST' });
        if (hookRes.ok) {
          buildTriggered = true;
          buildMethod = 'build_hook';
        }
      } catch (e) {
        console.log('Build hook trigger failed:', e.message);
      }
    }

    return new Response(JSON.stringify({
      ok: true,
      commitSha: result.commit.sha,
      commitUrl: result.commit.html_url,
      appsCount: apps.length,
      buildTriggered,
      buildMethod
    }), { status: 200, headers });
  } catch (e) {
    return new Response(JSON.stringify({ error: `Server error: ${e.message}` }), { status: 500, headers });
  }
};

export const config = { path: '/api/publish' };
