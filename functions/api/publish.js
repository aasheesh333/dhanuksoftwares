import { isAuthed, corsHeaders } from '../../lib/auth.mjs';
import { validateBlogPosts } from '../../lib/blog-schema.mjs';

const ALLOWED_ORIGINS = ['https://dhanuksoftwares.com', 'https://www.dhanuksoftwares.com'];

function json(data, status, headers) {
  return new Response(JSON.stringify(data), { status, headers });
}

function base64Encode(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

async function publishFile({ path, content, message, env }) {
  const GITHUB_TOKEN = env.GITHUB_TOKEN;
  const GITHUB_REPO = env.GITHUB_REPO || 'aasheesh333/dhanuksoftwares';
  const GITHUB_BRANCH = env.GITHUB_BRANCH || 'main';
  const getRes = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/contents/${path}?ref=${GITHUB_BRANCH}`, {
    headers: { 'Authorization': `Bearer ${GITHUB_TOKEN}`, 'Accept': 'application/vnd.github+json', 'User-Agent': 'dhanuksoftwares-admin' }
  });
  let sha;
  if (getRes.ok) {
    sha = (await getRes.json()).sha;
  } else if (getRes.status !== 404) {
    throw new Error(`GitHub GET failed: ${getRes.status}`);
  }

  const putRes = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/contents/${path}`, {
    method: 'PUT',
    headers: { 'Authorization': `Bearer ${GITHUB_TOKEN}`, 'Accept': 'application/vnd.github+json', 'Content-Type': 'application/json', 'User-Agent': 'dhanuksoftwares-admin' },
    body: JSON.stringify({ message, content: base64Encode(content), branch: GITHUB_BRANCH, ...(sha ? { sha } : {}) })
  });
  if (!putRes.ok) throw new Error(`GitHub PUT failed: ${putRes.status}`);
  return putRes.json();
}

async function triggerBuild(env) {
  const accountId = env.CLOUDFLARE_ACCOUNT_ID;
  const token = env.CLOUDFLARE_API_TOKEN;
  const project = env.PAGES_PROJECT || 'dhanuksoftwares';
  if (!accountId || !token) return { buildTriggered: false, buildMethod: 'git_integration_or_manual' };
  try {
    const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/pages/projects/${project}/deployments`, {
      method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({})
    });
    if (res.ok) return { buildTriggered: true, buildMethod: 'pages_api' };
    console.log('Pages deploy trigger failed:', res.status, (await res.text()).slice(0, 200));
  } catch (error) { console.log('Pages deploy trigger error:', error.message); }
  return { buildTriggered: false, buildMethod: 'git_integration_or_manual' };
}

export async function onRequest({ request, env }) {
  const headers = corsHeaders(request.headers.get('origin') || '', ALLOWED_ORIGINS);
  if (request.method === 'OPTIONS') return new Response('', { status: 200, headers });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405, headers);
  if (!await isAuthed(request, env)) return json({ error: 'Unauthorized' }, 401, headers);
  if (!env.GITHUB_TOKEN) return json({ error: 'GITHUB_TOKEN not configured. Add it in Cloudflare Pages env vars.' }, 500, headers);

  let body;
  try { body = await request.json(); } catch { return json({ error: 'Invalid JSON body' }, 400, headers); }

  let path;
  let content;
  let count;
  let kind;
  if (Array.isArray(body.apps)) {
    if (body.apps.length > 100) return json({ error: 'Too many apps (max 100)' }, 400, headers);
    for (const app of body.apps) {
      if (!app || typeof app !== 'object') return json({ error: 'Each app must be an object' }, 400, headers);
      if (typeof app.name !== 'string' || app.name.length > 200) return json({ error: 'App name must be string ≤200 chars' }, 400, headers);
      if (app.slug !== undefined && (typeof app.slug !== 'string' || !/^[a-z0-9-]{1,80}$/.test(app.slug))) return json({ error: 'App slug must match /^[a-z0-9-]{1,80}$/' }, 400, headers);
      if (Array.isArray(app.marketplaces)) {
        for (const marketplace of app.marketplaces) {
          if (!marketplace || typeof marketplace !== 'object') return json({ error: 'Each marketplace must be an object' }, 400, headers);
          if (typeof marketplace.url === 'string' && !/^https?:\/\//i.test(marketplace.url)) return json({ error: 'Marketplace URL must be http(s)' }, 400, headers);
        }
      }
    }
    path = 'apps.json'; content = JSON.stringify(body.apps, null, 2); count = body.apps.length; kind = 'apps';
  } else if (Array.isArray(body.posts)) {
    const validation = validateBlogPosts(body.posts);
    if (!validation.ok) return json({ error: validation.error }, 400, headers);
    path = 'posts.json'; content = JSON.stringify(body.posts, null, 2); count = body.posts.length; kind = 'posts';
  } else {
    return json({ error: 'apps[] or posts[] required' }, 400, headers);
  }

  try {
    const result = await publishFile({ path, content, message: `chore: update ${path} (${count} ${kind}) via admin [${new Date().toISOString()}]`, env });
    const deploy = await triggerBuild(env);
    return json({ ok: true, commitSha: result.commit.sha, commitUrl: result.commit.html_url, count, kind, ...deploy }, 200, headers);
  } catch (error) {
    return json({ error: `Server error: ${error.message}` }, 500, headers);
  }
}
