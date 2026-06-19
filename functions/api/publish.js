export async function onRequest({ request, env }) {
  const ADMIN_PASSWORD = env.ADMIN_PASSWORD;
  const GITHUB_TOKEN = env.GITHUB_TOKEN;
  const GITHUB_REPO = env.GITHUB_REPO || 'aasheesh333/dhanuksoftwares';
  const GITHUB_BRANCH = env.GITHUB_BRANCH || 'main';
  const CLOUDFLARE_ACCOUNT_ID = env.CLOUDFLARE_ACCOUNT_ID;
  const CLOUDFLARE_API_TOKEN = env.CLOUDFLARE_API_TOKEN;
  const PAGES_PROJECT = env.PAGES_PROJECT || 'dhanuksoftwares';

  const ALLOWED_ORIGINS = ['https://dhanuksoftwares.com', 'https://www.dhanuksoftwares.com'];
  const requestOrigin = request.headers.get('origin') || '';
  const allowOrigin = ALLOWED_ORIGINS.includes(requestOrigin) ? requestOrigin : ALLOWED_ORIGINS[0];
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': 'Content-Type, x-admin-token',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin'
  };

  if (request.method === 'OPTIONS') return new Response('', { status: 200, headers });
  if (request.method !== 'POST') return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers });

  const token = request.headers.get('x-admin-token');
  if (token !== ADMIN_PASSWORD) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers });
  }

  if (!GITHUB_TOKEN) {
    return new Response(JSON.stringify({ error: 'GITHUB_TOKEN not configured. Add it in Cloudflare Pages env vars.' }), { status: 500, headers });
  }

  let body;
  try { body = await request.json(); } catch (e) {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400, headers });
  }

  const apps = body.apps;
  if (!Array.isArray(apps)) {
    return new Response(JSON.stringify({ error: 'apps[] required' }), { status: 400, headers });
  }
  if (apps.length > 100) {
    return new Response(JSON.stringify({ error: 'Too many apps (max 100)' }), { status: 400, headers });
  }
  for (const app of apps) {
    if (!app || typeof app !== 'object') {
      return new Response(JSON.stringify({ error: 'Each app must be an object' }), { status: 400, headers });
    }
    if (typeof app.name !== 'string' || app.name.length > 200) {
      return new Response(JSON.stringify({ error: 'App name must be string ≤200 chars' }), { status: 400, headers });
    }
    if (app.slug !== undefined && (typeof app.slug !== 'string' || !/^[a-z0-9-]{1,80}$/.test(app.slug))) {
      return new Response(JSON.stringify({ error: 'App slug must match /^[a-z0-9-]{1,80}$/' }), { status: 400, headers });
    }
    if (Array.isArray(app.marketplaces)) {
      for (const m of app.marketplaces) {
        if (!m || typeof m !== 'object') {
          return new Response(JSON.stringify({ error: 'Each marketplace must be an object' }), { status: 400, headers });
        }
        if (typeof m.url === 'string' && !/^https?:\/\//i.test(m.url)) {
          return new Response(JSON.stringify({ error: 'Marketplace URL must be http(s)' }), { status: 400, headers });
        }
      }
    }
  }

  const content = JSON.stringify(apps, null, 2);
  const bytes = new TextEncoder().encode(content);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  const contentBase64 = btoa(binary);
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
      return new Response(JSON.stringify({ error: `GitHub GET failed: ${getRes.status}` }), { status: 502, headers });
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
      return new Response(JSON.stringify({ error: `GitHub PUT failed: ${putRes.status}` }), { status: 502, headers });
    }

    const result = await putRes.json();

    let buildTriggered = false;
    let buildMethod = 'none';
    if (CLOUDFLARE_ACCOUNT_ID && CLOUDFLARE_API_TOKEN) {
      try {
        const triggerRes = await fetch(`https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/pages/projects/${PAGES_PROJECT}/deployments`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({})
        });
        if (triggerRes.ok) {
          buildTriggered = true;
          buildMethod = 'pages_api';
        } else {
          const tErr = await triggerRes.text();
          console.log('Pages deploy trigger failed:', triggerRes.status, tErr.slice(0, 200));
        }
      } catch (e) {
        console.log('Pages deploy trigger error:', e.message);
      }
    }
    if (!buildTriggered) {
      buildMethod = 'git_integration_or_manual';
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
}