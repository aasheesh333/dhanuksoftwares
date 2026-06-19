import fs from 'node:fs';
import path from 'node:path';
import { renderApp } from './lib/render.mjs';
import { migrateAll } from './lib/migrate.mjs';
import { slugify, ensureUnique } from './lib/slug.mjs';

const ROOT = process.cwd();
const DIST = path.join(ROOT, 'dist');
const BASE_URL = process.env.URL || 'https://dhanuksoftwares.netlify.app';
const TODAY = new Date().toISOString().slice(0, 10);

function rmrf(p) {
  if (fs.existsSync(p)) fs.rmSync(p, { recursive: true, force: true });
}

function mkdirp(p) {
  fs.mkdirSync(p, { recursive: true });
}

function copyFile(src, dest) {
  mkdirp(path.dirname(dest));
  fs.copyFileSync(src, dest);
}

function copyDir(src, dest) {
  if (!fs.existsSync(src)) return;
  mkdirp(dest);
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else copyFile(s, d);
  }
}

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function writeFile(p, content) {
  mkdirp(path.dirname(p));
  fs.writeFileSync(p, content);
}

function renderAppsIndex(apps, baseUrl) {
  const cards = apps.map(a => `
    <a class="app-card" href="/apps/${a.slug}/">
      ${a.icon ? `<img class="app-icon-img" src="${a.icon}" alt="${a.name}"/>` : `<div class="app-emoji">${a.emoji || '📱'}</div>`}
      <div class="app-name">${a.name}</div>
      <div class="app-desc">${a.shortDesc || ''}</div>
      <div class="app-footer"><span class="app-tag">${a.category || a.tag || 'Android'}</span></div>
    </a>`).join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>All Apps - Dhanuk Softwares</title>
  <meta name="description" content="Browse all Android apps from Dhanuk Softwares."/>
  <link rel="canonical" href="${baseUrl}/apps/"/>
  <link rel="preconnect" href="https://fonts.googleapis.com"/>
  <link href="https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:wght@300;400;500&display=swap" rel="stylesheet"/>
  <style>
    body { background:#0b0f1a; color:#e8edf7; font-family:'DM Sans',sans-serif; margin:0; padding:0; }
    .container { max-width:1100px; margin:0 auto; padding:2rem 5%; }
    h1 { font-family:'Syne',sans-serif; font-size:2.2rem; margin-bottom:0.5rem; }
    .lead { color:#7a8aaa; margin-bottom:2rem; }
    .grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(260px,1fr)); gap:1.5rem; }
    .app-card { background:#1a2235; border:1px solid #1e2d4a; border-radius:16px; padding:2rem; text-decoration:none; color:#e8edf7; transition:border-color 0.2s, transform 0.2s; }
    .app-card:hover { border-color:#4f8ef7; transform:translateY(-3px); }
    .app-icon-img { width:56px; height:56px; border-radius:12px; margin-bottom:1rem; }
    .app-emoji { font-size:2.5rem; margin-bottom:1rem; }
    .app-name { font-family:'Syne',sans-serif; font-size:1.15rem; font-weight:700; margin-bottom:0.5rem; }
    .app-desc { color:#7a8aaa; font-size:0.9rem; }
    .app-footer { margin-top:1rem; }
    .app-tag { display:inline-block; font-size:0.75rem; padding:0.25rem 0.75rem; border-radius:999px; background:rgba(79,142,247,0.1); color:#4f8ef7; border:1px solid rgba(79,142,247,0.2); }
  </style>
</head>
<body>
  <div class="container">
    <h1>All Apps by Dhanuk Softwares</h1>
    <p class="lead">${apps.length} free Android apps. Tap any to download.</p>
    <div class="grid">${cards}</div>
  </div>
</body>
</html>`;
}

function generateSitemap(apps, baseUrl) {
  const urls = [
    { loc: `${baseUrl}/`, priority: '1.0', changefreq: 'weekly' },
    { loc: `${baseUrl}/apps/`, priority: '0.9', changefreq: 'weekly' }
  ];
  for (const app of apps) {
    urls.push({
      loc: `${baseUrl}/apps/${app.slug}/`,
      priority: '0.8',
      changefreq: 'monthly',
      lastmod: app.lastUpdated || TODAY
    });
  }
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url>
    <loc>${u.loc}</loc>
    <lastmod>${u.lastmod || TODAY}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`).join('\n')}
</urlset>`;
}

function generateRobots(baseUrl) {
  return `User-agent: *
Allow: /
Disallow: /admin/
Disallow: /docs/

Sitemap: ${baseUrl}/sitemap.xml
`;
}

async function main() {
  console.log('Building dhanuksoftwares site...');

  rmrf(DIST);
  mkdirp(DIST);

  const rawApps = readJson(path.join(ROOT, 'apps.json'));
  const apps = migrateAll(rawApps);
  console.log(`${apps.length} apps loaded`);

  const usedSlugs = new Set();
  for (const app of apps) {
    if (!app.slug) app.slug = slugify(app.name);
    app.slug = ensureUnique(app.slug, usedSlugs);
    usedSlugs.add(app.slug);
  }

  for (const app of apps) {
    const related = apps
      .filter(a => a.slug !== app.slug)
      .slice(0, 4)
      .map(a => ({ name: a.name, slug: a.slug, emoji: a.emoji, shortDesc: a.shortDesc }));
    const html = renderApp(app, BASE_URL, related);
    const outPath = path.join(DIST, 'apps', app.slug, 'index.html');
    writeFile(outPath, html);
    console.log(`  /apps/${app.slug}/`);
  }

  const appsIndexHtml = renderAppsIndex(apps, BASE_URL);
  writeFile(path.join(DIST, 'apps', 'index.html'), appsIndexHtml);
  console.log('  /apps/');

  const homeSrc = path.join(ROOT, 'index.html');
  if (fs.existsSync(homeSrc)) {
    fs.copyFileSync(homeSrc, path.join(DIST, 'index.html'));
    console.log('  /');
  }

  const adminSrc = path.join(ROOT, 'docs', 'admin.html');
  if (fs.existsSync(adminSrc)) {
    const adminHtml = fs.readFileSync(adminSrc, 'utf8');
    const injected = injectSecrets(adminHtml);
    const adminDir = path.join(DIST, 'admin');
    mkdirp(adminDir);
    fs.writeFileSync(path.join(adminDir, 'index.html'), injected);
    const docsDir = path.join(DIST, 'docs');
    mkdirp(docsDir);
    fs.writeFileSync(path.join(docsDir, 'admin.html'), injected);
    console.log('  /admin/');
  }

  for (const f of ['app-ads.txt', 'CNAME', 'apps.json']) {
    const src = path.join(ROOT, f);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, path.join(DIST, f));
    }
  }

  for (const dir of ['icons', 'screens', 'images', 'assets']) {
    const src = path.join(ROOT, dir);
    if (fs.existsSync(src)) {
      copyDir(src, path.join(DIST, dir));
    }
  }

  const sitemap = generateSitemap(apps, BASE_URL);
  writeFile(path.join(DIST, 'sitemap.xml'), sitemap);
  console.log('  /sitemap.xml');

  const robots = generateRobots(BASE_URL);
  writeFile(path.join(DIST, 'robots.txt'), robots);
  console.log('  /robots.txt');

  const headers = generateHeaders();
  writeFile(path.join(DIST, '_headers'), headers);
  console.log('  /_headers');

  const redirects = generateRedirects();
  writeFile(path.join(DIST, '_redirects'), redirects);
  console.log('  /_redirects');

  console.log('Build complete -> dist/');
}

function generateHeaders() {
  return `/*
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: geolocation=(), microphone=(), camera=()

/index.html
  Cache-Control: public, max-age=0, must-revalidate

/admin/*
  Cache-Control: public, max-age=0, must-revalidate
  X-Robots-Tag: noindex, nofollow

/docs/*
  Cache-Control: public, max-age=0, must-revalidate
  X-Robots-Tag: noindex, nofollow

/apps.json
  Cache-Control: public, max-age=300, must-revalidate
`;
}

function generateRedirects() {
  return `/admin /admin/ 301
`;
}

function injectSecrets(html) {
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) {
    console.warn('  ⚠ ADMIN_PASSWORD not set — admin login will not work');
  }
  return html.replace(/__ADMIN_PASSWORD__/g, adminPassword || '');
}

main().catch(e => { console.error(e); process.exit(1); });
