import fs from 'node:fs';
import path from 'node:path';
import { renderApp } from './lib/render.mjs';
import { migrateAll } from './lib/migrate.mjs';
import { slugify, ensureUnique } from './lib/slug.mjs';

const ROOT = process.cwd();
const DIST = path.join(ROOT, 'dist');
const BASE_URL = process.env.URL || 'https://dhanuksoftwares.com';
const TODAY = new Date().toISOString().slice(0, 10);

// Best-effort Play Store scrape: pulls lastUpdated + developer + totalDownloads
// Updates apps.json in-place if values change so build output reflects Play Store.
async function autoFetchFromPlayStore(apps) {
  const PLAY_URL_RE = /^https?:\/\/play\.google\.com\/store\/apps\/details\?id=([a-zA-Z0-9._]+)/;
  let dirty = false;
  for (const app of apps) {
    const play = (app.marketplaces || []).find(m => m.type === 'play' && PLAY_URL_RE.test(m.url || ''));
    if (!play) continue;
    const appId = PLAY_URL_RE.exec(play.url)[1];
    try {
      const url = `https://play.google.com/store/apps/details?id=${appId}&hl=en`;
      const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36' } });
      if (!res.ok) { console.warn(`  ! play store fetch ${appId} -> ${res.status}`); continue; }
      const html = await res.text();
      // Updated on Jun 15, 2026
      const dateMatch = html.match(/([A-Z][a-z]+)\s+(\d{1,2}),\s+(\d{4})/);
      let lastUpdated = app.lastUpdated;
      if (dateMatch) {
        const months = { Jan:0,Feb:1,Mar:2,Apr:3,May:4,Jun:5,Jul:6,Aug:7,Sep:8,Oct:9,Nov:10,Dec:11 };
        const m = months[dateMatch[1]];
        const d = parseInt(dateMatch[2], 10);
        const y = parseInt(dateMatch[3], 10);
        if (m != null) {
          const iso = `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
          if (iso !== app.lastUpdated) {
            console.log(`  ~ ${app.slug}: lastUpdated ${app.lastUpdated || '(none)'} -> ${iso}`);
            app.lastUpdated = iso;
            lastUpdated = iso;
            dirty = true;
          }
        }
      }
      // Developer (from developer link in head_app_info or "wMUdtb" class)
      let devMatch = html.match(/href="\/store\/apps\/dev[eloper]*\?id=[^"]+"[^>]*>\s*([^<]+)/);
      if (!devMatch) devMatch = html.match(/class="wMUdtb">([^<]+)/);
      if (devMatch) {
        const dev = devMatch[1].trim();
        if (dev && dev !== app.developer) {
          console.log(`  ~ ${app.slug}: developer ${app.developer || '(none)'} -> ${dev}`);
          app.developer = dev;
          dirty = true;
        }
      }
      // Total downloads: try "100K+" or "100K" patterns
      let dlMatch = html.match(/(\d+(?:\.\d+)?[KMB]\+?)\s*(?:Downloads|Installs)/i);
      if (dlMatch) {
        const dl = dlMatch[1].replace(/\.0(?=[KMB])/, '') + (dlMatch[1].includes('+') ? '' : '+');
        if (dl !== app.totalDownloads) {
          console.log(`  ~ ${app.slug}: totalDownloads ${app.totalDownloads || '(none)'} -> ${dl}`);
          app.totalDownloads = dl;
          dirty = true;
        }
      }
    } catch (e) {
      console.warn(`  ! play store fetch ${appId} error:`, e.message);
    }
  }
  return dirty;
}

function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

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
  const hasApps = apps.length > 0;
  const description = hasApps
    ? `Browse all ${apps.length} free Android app${apps.length === 1 ? '' : 's'} from Dhanuk Softwares. Download on Google Play, Uptodown, OPPO, Vivo, and more.`
    : 'Dhanuk Softwares is an Indian Android app studio building simple, smart, and useful apps for everyday life. New apps coming soon.';
  const ogDescription = hasApps
    ? `Browse all ${apps.length} free Android app${apps.length === 1 ? '' : 's'} from Dhanuk Softwares. Download on Google Play, Uptodown, OPPO, Vivo, and more.`
    : 'Indian Android app studio building simple, smart, and useful apps for everyday life. New apps coming soon.';
  const lead = hasApps
    ? `${apps.length} free Android app${apps.length === 1 ? '' : 's'}. Tap any to learn more.`
    : 'No apps published yet — check back soon. In the meantime, learn more about us below.';

  const cards = apps.map(a => `
    <a class="app-card" href="/apps/${a.slug}/" data-app-card data-search="${escapeHtml(((a.name || '') + ' ' + (a.shortDesc || '') + ' ' + (a.category || a.tag || '') + ' ' + (a.keywords || []).join(' ')).toLowerCase())}">
      ${a.icon ? `<img class="app-icon-img" src="${escapeHtml(a.icon)}" alt="${escapeHtml(a.name)}" loading="lazy" width="56" height="56"/>` : `<div class="app-emoji">${escapeHtml(a.emoji || '📱')}</div>`}
      <div class="app-name">${escapeHtml(a.name)}</div>
      <div class="app-desc">${escapeHtml(a.shortDesc || '')}</div>
      <div class="app-footer"><span class="app-tag">${escapeHtml(a.category || a.tag || 'Android')}</span></div>
    </a>`).join('\n');

  const itemListJson = hasApps ? JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Dhanuk Softwares — Apps Catalog',
    itemListElement: apps.map((app, idx) => ({
      '@type': 'ListItem',
      position: idx + 1,
      url: `${baseUrl}/apps/${app.slug}/`,
      name: app.name || ''
    }))
  }, null, 2).replace(/</g, '\\u003c') : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>All Apps by Dhanuk Softwares</title>
  <meta name="description" content="${escapeHtml(description)}"/>
  <meta name="keywords" content="Dhanuk Softwares apps, free Android apps India, Indian app studio, Google Play apps India"/>
  <meta name="robots" content="index, follow, max-image-preview:large"/>
  <link rel="canonical" href="${baseUrl}/apps/"/>
  <link rel="icon" type="image/svg+xml" href="${baseUrl}/favicon.svg"/>
  <link rel="apple-touch-icon" href="${baseUrl}/apple-touch-icon.png"/>
  <link rel="manifest" href="${baseUrl}/manifest.json"/>
  <meta name="theme-color" content="#0b0f1a"/>

  <meta property="og:title" content="All Apps by Dhanuk Softwares"/>
  <meta property="og:description" content="${escapeHtml(ogDescription)}"/>
  <meta property="og:url" content="${baseUrl}/apps/"/>
  <meta property="og:type" content="website"/>
  <meta property="og:site_name" content="Dhanuk Softwares"/>
  <meta property="og:locale" content="en_IN"/>
  <meta property="og:image" content="${baseUrl}/og-banner.png"/>

  <meta name="twitter:card" content="summary_large_image"/>
  <meta name="twitter:title" content="All Apps by Dhanuk Softwares"/>
  <meta name="twitter:description" content="${escapeHtml(ogDescription)}"/>
  <meta name="twitter:image" content="${baseUrl}/og-banner.png"/>

  <link rel="preconnect" href="https://fonts.googleapis.com"/>
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
  <link href="https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:wght@300;400;500&display=swap" rel="stylesheet"/>
  <style>
    :root { --bg:#0b0f1a; --surface:#131929; --card:#1a2235; --accent:#4f8ef7; --accent2:#38e0b0; --text:#e8edf7; --muted:#a0b0cc; --border:#1e2d4a; }
    *,*::before,*::after { box-sizing:border-box; margin:0; padding:0; }
    html { scroll-behavior:smooth; overflow-wrap:break-word; }
    body { background:var(--bg); color:var(--text); font-family:'DM Sans',sans-serif; line-height:1.7; overflow-x:hidden; min-height:100vh; display:flex; flex-direction:column; overflow-wrap:break-word; }
    body, p, li, h1, h2, h3, h4, a, span, dd, dt, blockquote, code, pre { overflow-wrap:break-word; word-wrap:break-word; }
    a:focus-visible, button:focus-visible { outline:2px solid var(--accent); outline-offset:2px; border-radius:4px; }
    .skip-link { position:absolute; left:-9999px; top:0; background:var(--accent); color:#fff; padding:0.7rem 1.2rem; z-index:200; border-radius:0 0 8px 0; text-decoration:none; font-weight:600; }
    .skip-link:focus { left:0; }
    nav { position:sticky; top:0; z-index:50; display:flex; align-items:center; justify-content:space-between; padding:1rem 5%; background:rgba(11,15,26,0.92); backdrop-filter:blur(12px); border-bottom:1px solid var(--border); }
    .nav-logo { font-family:'Syne',sans-serif; font-weight:800; font-size:1.2rem; color:#fff; text-decoration:none; }
    .nav-logo span { color:var(--accent2); }
    .nav-toggle { display:none; background:transparent; border:1px solid var(--border); border-radius:8px; padding:0.5rem; cursor:pointer; flex-direction:column; gap:4px; width:38px; height:38px; align-items:center; justify-content:center; }
    .nav-toggle-bar { display:block; width:18px; height:2px; background:var(--text); border-radius:1px; transition:transform 0.2s, opacity 0.2s; }
    .nav-toggle[aria-expanded="true"] .nav-toggle-bar:nth-child(1) { transform:translateY(6px) rotate(45deg); }
    .nav-toggle[aria-expanded="true"] .nav-toggle-bar:nth-child(2) { opacity:0; }
    .nav-toggle[aria-expanded="true"] .nav-toggle-bar:nth-child(3) { transform:translateY(-6px) rotate(-45deg); }
    nav ul { list-style:none; display:flex; gap:1.5rem; }
    nav ul a { text-decoration:none; color:var(--muted); font-size:0.9rem; font-weight:500; }
    nav ul a:hover { color:var(--text); }
    main { flex:1; padding:3rem 5%; }
    .container { max-width:1100px; margin:0 auto; }
    .page-title { font-family:'Syne',sans-serif; font-size:clamp(1.8rem, 4vw, 2.6rem); font-weight:800; letter-spacing:-0.02em; margin-bottom:0.5rem; }
    .breadcrumb { padding:1rem 5%; font-size:0.85rem; color:var(--muted); }
    .breadcrumb a { color:var(--muted); text-decoration:none; }
    .breadcrumb a:hover { color:var(--accent); }
    .breadcrumb span { word-break:break-word; }
    .search-bar { margin: 1rem 0 2rem; max-width: 480px; }
    .search-bar input { width:100%; padding: 0.85rem 1.1rem; border-radius: 12px; background: var(--card); border: 1px solid var(--border); color: var(--text); font-family: 'DM Sans', sans-serif; font-size: 0.95rem; }
    .search-bar input:focus { outline:none; border-color: var(--accent); }
    .search-bar input::placeholder { color: var(--muted); }
    .lead { color:var(--muted); margin-bottom:2rem; font-size:1.05rem; }
    .grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(260px,1fr)); gap:1.5rem; }
    .app-card { background:var(--card); border:1px solid var(--border); border-radius:16px; padding:2rem; text-decoration:none; color:var(--text); transition:border-color 0.2s, transform 0.2s; display:block; min-width:0; }
    .app-card:hover { border-color:var(--accent); transform:translateY(-3px); }
    .app-card[hidden] { display:none; }
    .app-card.empty-state { grid-column: 1 / -1; text-align:center; padding: 3rem 2rem; color: var(--muted); }
    .app-icon-img { width:56px; height:56px; border-radius:12px; margin-bottom:1rem; object-fit:cover; }
    .app-emoji { font-size:2.5rem; margin-bottom:1rem; line-height:1; }
    .app-name { font-family:'Syne',sans-serif; font-size:1.15rem; font-weight:700; margin-bottom:0.5rem; }
    .app-desc { color:var(--muted); font-size:0.9rem; line-height:1.5; }
    .app-footer { margin-top:1rem; }
    .app-tag { display:inline-block; font-size:0.75rem; padding:0.25rem 0.75rem; border-radius:999px; background:rgba(79,142,247,0.1); color:var(--accent); border:1px solid rgba(79,142,247,0.2); }
    .empty-state-block { text-align:center; padding: 3rem 2rem; background: var(--surface); border:1px solid var(--border); border-radius: 16px; color: var(--muted); }
    .empty-state-block h2 { font-family:'Syne',sans-serif; font-size: 1.4rem; font-weight:700; color: var(--text); margin-bottom:0.5rem; }
    .empty-state-block a { color: var(--accent); text-decoration:none; font-weight:600; }
    .empty-state-block a:hover { text-decoration:underline; }
    footer { text-align:center; padding:2rem 5%; border-top:1px solid var(--border); color:var(--muted); font-size:0.85rem; margin-top:2rem; }
    footer a { color:var(--accent); text-decoration:none; }
    footer .footer-links a { margin: 0 0.4rem; }
    @media (max-width: 768px) {
      .nav-toggle { display:flex; }
      nav ul { display:none; position:absolute; top:100%; left:0; right:0; flex-direction:column; gap:0; background:rgba(11,15,26,0.98); border-bottom:1px solid var(--border); padding:0.5rem 0; }
      nav ul.open { display:flex; }
      nav ul li { width:100%; }
      nav ul a { display:block; padding:0.75rem 5%; }
      main { padding:2rem 5%; }
      .grid { grid-template-columns:1fr; gap:1rem; }
      .app-card { padding:1.5rem; }
    }
    @media (prefers-reduced-motion: reduce) {
      *,*::before,*::after { animation-duration:0.01ms !important; transition-duration:0.01ms !important; scroll-behavior:auto !important; }
    }
  </style>${hasApps ? `
  <!-- JSON-LD: ItemList of apps for search-engine discovery -->
  <script type="application/ld+json">
${itemListJson}
  </script>` : ''}
</head>
<body>
  <a href="#main" class="skip-link">Skip to main content</a>
  <nav>
    <a class="nav-logo" href="${baseUrl}/">Dhanuk<span>Softwares</span></a>
    <button class="nav-toggle" id="nav-toggle" aria-controls="nav-menu" aria-expanded="false" aria-label="Open navigation menu">
      <span class="nav-toggle-bar"></span><span class="nav-toggle-bar"></span><span class="nav-toggle-bar"></span>
    </button>
    <ul id="nav-menu">
      <li><a href="${baseUrl}/">Home</a></li>
      <li><a href="${baseUrl}/apps/">All Apps</a></li>
      <li><a href="${baseUrl}/privacy/">Privacy</a></li>
      <li><a href="${baseUrl}/terms/">Terms</a></li>
    </ul>
  </nav>
  <main id="main">
    <div class="container">
      <nav class="breadcrumb" aria-label="Breadcrumb">
        <a href="${baseUrl}/">Home</a> &rsaquo; <span>All Apps</span>
      </nav>
      <h1 class="page-title">All Apps by Dhanuk Softwares</h1>
      <p class="lead">${escapeHtml(lead)}</p>${hasApps ? `
      <div class="search-bar">
        <input type="search" id="app-search" placeholder="Search apps by name, category, or keyword..." aria-label="Search apps"/>
      </div>` : ''}
      <div class="grid" id="apps-grid">${hasApps ? cards : `<div class="empty-state-block"><h2>No apps yet</h2><p>We're building new apps — check back soon. <a href="${baseUrl}/#apps">Read more about us</a> or <a href="${baseUrl}/#contact">get in touch</a>.</p></div>`}</div>
    </div>
  </main>
  <footer>
    <p>&copy; <span id="footer-year">2026</span> <strong>Dhanuk Softwares</strong>. All rights reserved.</p>
    <p class="footer-links" style="margin-top:0.4rem;">
      <a href="${baseUrl}/">Home</a> &middot;
      <a href="${baseUrl}/apps/">Apps</a> &middot;
      <a href="${baseUrl}/privacy/">Privacy</a> &middot;
      <a href="${baseUrl}/terms/">Terms</a> &middot;
      <a href="mailto:support@dhanuksoftwares.com">Support</a>
    </p>
    <p style="margin-top:0.4rem;">Made with &#9829; in India &middot; GST &amp; MSME Registered</p>
  </footer>
  <script>
    document.getElementById('footer-year').textContent = new Date().getFullYear();
    (function() {
      var btn = document.getElementById('nav-toggle');
      var menu = document.getElementById('nav-menu');
      if (!btn || !menu) return;
      btn.addEventListener('click', function() {
        var open = menu.classList.toggle('open');
        btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
      menu.querySelectorAll('a').forEach(function(a) {
        a.addEventListener('click', function() {
          menu.classList.remove('open');
          btn.setAttribute('aria-expanded', 'false');
        });
      });
    })();
    // Client-side search for WebSite schema SearchAction target
    (function() {
      var input = document.getElementById('app-search');
      if (!input) return;
      var cards = Array.prototype.slice.call(document.querySelectorAll('[data-app-card]'));
      var url = new URL(window.location.href);
      var initialQ = (url.searchParams.get('q') || '').toLowerCase().trim();
      if (initialQ) input.value = initialQ;
      function applyFilter(q) {
        q = (q || '').toLowerCase().trim();
        var visible = 0;
        cards.forEach(function(c) {
          var hay = c.getAttribute('data-search') || '';
          var match = !q || hay.indexOf(q) !== -1;
          if (match) { c.hidden = false; visible++; } else { c.hidden = true; }
        });
        // Show/hide no-results message
        var existing = document.getElementById('no-results');
        if (q && visible === 0) {
          if (!existing) {
            var div = document.createElement('div');
            div.id = 'no-results';
            div.className = 'empty-state-block';
            div.style.marginTop = '1rem';
            div.innerHTML = '<h2>No matches</h2><p>No apps match "<span id="qterm"></span>". Try a different search term.</p>';
            document.getElementById('apps-grid').after(div);
          }
          document.getElementById('qterm').textContent = q;
        } else if (existing) {
          existing.remove();
        }
        // Update URL (replaceState, no scroll)
        var newUrl = q ? '?q=' + encodeURIComponent(q) : window.location.pathname;
        window.history.replaceState({}, '', newUrl);
      }
      applyFilter(initialQ);
      var t;
      input.addEventListener('input', function() {
        clearTimeout(t);
        t = setTimeout(function() { applyFilter(input.value); }, 100);
      });
    })();
  </script>
</body>
</html>`;
}

function generateSitemap(apps, baseUrl) {
  const urls = [
    { loc: `${baseUrl}/`, priority: '1.0', changefreq: 'weekly', lastmod: TODAY },
    { loc: `${baseUrl}/apps/`, priority: '0.9', changefreq: 'weekly', lastmod: TODAY },
    { loc: `${baseUrl}/privacy/`, priority: '0.3', changefreq: 'yearly', lastmod: TODAY },
    { loc: `${baseUrl}/terms/`, priority: '0.3', changefreq: 'yearly', lastmod: TODAY },
    { loc: `${baseUrl}/cookies/`, priority: '0.3', changefreq: 'yearly', lastmod: TODAY }
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

  // Auto-fetch lastUpdated + developer from Play Store for any app with a Play Store URL
  console.log('  Auto-fetching from Play Store...');
  const playStoreDirty = await autoFetchFromPlayStore(apps);
  if (playStoreDirty) {
    fs.writeFileSync(path.join(ROOT, 'apps.json'), JSON.stringify(apps, null, 2) + '\n');
    console.log('  apps.json updated');
  }

  const usedSlugs = new Set();
  for (const app of apps) {
    if (!app.slug) app.slug = slugify(app.name);
    app.slug = ensureUnique(app.slug, usedSlugs);
    usedSlugs.add(app.slug);
  }

  for (const app of apps) {
    const related = apps
      .filter(a => a.slug !== app.slug)
      .slice(0, 6)
      .map(a => ({ name: a.name, slug: a.slug, emoji: a.emoji, icon: a.icon, shortDesc: a.shortDesc, category: a.category }));
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
    let homeHtml = fs.readFileSync(homeSrc, 'utf8');
    homeHtml = injectHomeOrganization(homeHtml);
    homeHtml = injectHomeItemList(homeHtml, apps);
    homeHtml = injectHomeWebSiteSchema(homeHtml);
    homeHtml = injectHomeAppsList(homeHtml, apps);
    fs.writeFileSync(path.join(DIST, 'index.html'), homeHtml);
    console.log('  /');
  }

  const adminSrc = path.join(ROOT, 'docs', 'admin.html');
  if (fs.existsSync(adminSrc)) {
    const adminHtml = fs.readFileSync(adminSrc, 'utf8');
    mkdirp(path.join(DIST, 'admin'));
    fs.writeFileSync(path.join(DIST, 'admin/index.html'), adminHtml);
    mkdirp(path.join(DIST, 'docs'));
    fs.writeFileSync(path.join(DIST, 'docs/admin.html'), adminHtml);
    console.log('  /admin/ (no secrets in source — uses /api/login)');
  }

  for (const f of ['app-ads.txt', 'CNAME', 'apps.json', 'og-banner.png', 'favicon.svg', 'apple-touch-icon.png', 'manifest.json']) {
    const src = path.join(ROOT, f);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, path.join(DIST, f));
    }
  }

  // SEO: Privacy / Terms / Cookies policy pages (each becomes /<page>/index.html)
  for (const page of ['privacy', 'terms', 'cookies']) {
    const src = path.join(ROOT, `${page}.html`);
    if (fs.existsSync(src)) {
      const pageDir = path.join(DIST, page);
      mkdirp(pageDir);
      fs.copyFileSync(src, path.join(pageDir, 'index.html'));
      console.log(`  /${page}/`);
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

  const redirects = generateRedirects(apps);
  writeFile(path.join(DIST, '_redirects'), redirects);
  console.log('  /_redirects');

  const fourOhFour = generate404Html(apps);
  writeFile(path.join(DIST, '404.html'), fourOhFour);
  console.log('  /404.html');

  console.log('Build complete -> dist/');
}

function generate404Html(apps) {
  // Build suggestions grid dynamically from current apps (no dead links)
  const suggestions = (apps || []).slice(0, 4).map(a => {
    const emoji = a.emoji || '📱';
    return `<a href="${BASE_URL}/apps/${a.slug}/"><span class="emoji">${escapeHtml(emoji)}</span><span class="name">${escapeHtml(a.name)}</span></a>`;
  }).join('\n');
  const showSuggestions = suggestions.length > 0;
  const suggestionsBlock = showSuggestions
    ? `<div class="suggestions">
        <h2>${apps.length === 1 ? 'Browse our app' : 'Browse our apps'}</h2>
        <div class="suggestions-grid">
          ${suggestions}
        </div>
      </div>`
    : `<div class="suggestions-empty">
        <h2>Want to see what we build?</h2>
        <p>We're a small Indian Android app studio. <a href="${BASE_URL}/apps/">Check back soon</a> or <a href="${BASE_URL}/#contact">get in touch</a>.</p>
      </div>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Page Not Found · Dhanuk Softwares</title>
  <meta name="description" content="The page you're looking for doesn't exist. Browse our apps or head back home."/>
  <meta name="robots" content="noindex, nofollow"/>
  <link rel="canonical" href="${BASE_URL}/"/>
  <meta property="og:title" content="Page Not Found · Dhanuk Softwares"/>
  <meta property="og:description" content="The page you're looking for doesn't exist. Browse our apps or head back home."/>
  <meta property="og:url" content="${BASE_URL}/"/>
  <meta property="og:type" content="website"/>
  <meta property="og:site_name" content="Dhanuk Softwares"/>
  <link rel="preconnect" href="https://fonts.googleapis.com"/>
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
  <link href="https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:wght@300;400;500&display=swap" rel="stylesheet"/>
  <style>
    :root { --bg:#0b0f1a; --surface:#131929; --card:#1a2235; --accent:#4f8ef7; --accent2:#38e0b0; --text:#e8edf7; --muted:#a0b0cc; --border:#1e2d4a; }
    *,*::before,*::after { box-sizing:border-box; margin:0; padding:0; }
    html { scroll-behavior:smooth; overflow-wrap:break-word; }
    body { background:var(--bg); color:var(--text); font-family:'DM Sans',sans-serif; line-height:1.7; overflow-x:hidden; display:flex; flex-direction:column; min-height:100vh; }
    nav { position:sticky; top:0; z-index:50; display:flex; align-items:center; justify-content:space-between; padding:1rem 5%; background:rgba(11,15,26,0.92); backdrop-filter:blur(12px); border-bottom:1px solid var(--border); }
    .nav-logo { font-family:'Syne',sans-serif; font-weight:800; font-size:1.2rem; color:#fff; text-decoration:none; }
    .nav-logo span { color:var(--accent2); }
    nav ul { list-style:none; display:flex; gap:2rem; }
    nav ul a { text-decoration:none; color:var(--muted); font-size:0.9rem; font-weight:500; }
    nav ul a:hover { color:var(--text); }
    main { flex:1; display:flex; align-items:center; justify-content:center; padding:4rem 5%; text-align:center; }
    .error-code { font-family:'Syne',sans-serif; font-size:clamp(5rem, 18vw, 9rem); font-weight:800; line-height:1; background:linear-gradient(135deg, var(--accent), var(--accent2)); -webkit-background-clip:text; background-clip:text; color:transparent; letter-spacing:-0.04em; margin-bottom:1rem; }
    h1 { font-family:'Syne',sans-serif; font-size:clamp(1.6rem, 4vw, 2.4rem); font-weight:700; letter-spacing:-1px; margin-bottom:0.75rem; }
    p { color:var(--muted); max-width:520px; margin:0 auto 2rem; font-size:1.05rem; }
    .actions { display:flex; gap:0.75rem; justify-content:center; flex-wrap:wrap; margin-bottom:3rem; }
    .btn { padding:0.85rem 1.6rem; border-radius:10px; text-decoration:none; font-weight:600; font-size:1rem; display:inline-flex; align-items:center; gap:0.5rem; transition:transform 0.15s, background 0.2s; max-width:100%; white-space:normal; text-align:center; justify-content:center; }
    .btn-primary { background:var(--accent); color:#fff; }
    .btn-primary:hover { background:#3a7de8; transform:translateY(-1px); }
    .btn-outline { background:transparent; border:1px solid var(--border); color:var(--text); }
    .btn-outline:hover { border-color:var(--accent); color:var(--accent); }
    .suggestions { max-width:680px; margin:0 auto; }
    .suggestions h2 { font-family:'Syne',sans-serif; font-size:1.1rem; font-weight:700; color:var(--muted); margin-bottom:1rem; text-align:left; }
    .suggestions-grid { display:grid; grid-template-columns:repeat(auto-fit, minmax(140px, 1fr)); gap:0.75rem; }
    .suggestions a { background:var(--card); border:1px solid var(--border); border-radius:10px; padding:1rem; text-decoration:none; color:var(--text); text-align:center; transition:border-color 0.2s, transform 0.15s; display:block; }
    .suggestions a:hover { border-color:var(--accent); transform:translateY(-2px); }
    .suggestions a .emoji { font-size:1.6rem; display:block; margin-bottom:0.4rem; }
    .suggestions a .name { font-family:'Syne',sans-serif; font-weight:700; font-size:0.95rem; }
    .suggestions-empty { max-width:520px; margin:0 auto; padding:1.5rem; background:var(--surface); border:1px solid var(--border); border-radius:12px; }
    .suggestions-empty h2 { font-family:'Syne',sans-serif; font-size:1.1rem; font-weight:700; color:var(--text); margin-bottom:0.5rem; }
    .suggestions-empty a { color:var(--accent); text-decoration:none; font-weight:600; }
    .suggestions-empty a:hover { text-decoration:underline; }
    footer { text-align:center; padding:2rem 5%; border-top:1px solid var(--border); color:var(--muted); font-size:0.85rem; }
    footer a { color:var(--accent); text-decoration:none; }
    @media (max-width: 768px) { nav ul { display:none; } }
  </style>
</head>
<body>
  <nav>
    <a class="nav-logo" href="${BASE_URL}/">Dhanuk<span>Softwares</span></a>
    <ul>
      <li><a href="${BASE_URL}/#apps">Apps</a></li>
      <li><a href="${BASE_URL}/apps/">All Apps</a></li>
      <li><a href="${BASE_URL}/#contact">Contact</a></li>
    </ul>
  </nav>
  <main>
    <div>
      <div class="error-code">404</div>
      <h1>This page doesn't exist</h1>
      <p>The link may be broken, or the page may have been removed. Head back home or check out our apps below.</p>
      <div class="actions">
        <a class="btn btn-primary" href="${BASE_URL}/">&larr; Back to Home</a>
        <a class="btn btn-outline" href="${BASE_URL}/apps/">View All Apps</a>
      </div>
      ${suggestionsBlock}
    </div>
  </main>
  <footer>
    <p>&copy; <span id="footer-year">2026</span> <strong>Dhanuk Softwares</strong> · GST &amp; MSME Registered · Made with love in India</p>
  </footer>
  <script>document.getElementById('footer-year').textContent = new Date().getFullYear();</script>
</body>
</html>
`;
}

function generateHeaders() {
  return `/*
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: geolocation=(), microphone=(), camera=()
  Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
  Content-Security-Policy: default-src 'self'; img-src 'self' data: https:; script-src 'self' 'unsafe-inline' https://*.cloudflareinsights.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; connect-src 'self' https:; frame-ancestors 'none'

# SEO: cache homepage and apps index for 5 minutes — cuts TTFB from ~500ms to <100ms for repeat visitors
# Admin/docs always revalidate so admin edits show immediately
/
  Cache-Control: public, max-age=300, must-revalidate

/index.html
  Cache-Control: public, max-age=300, must-revalidate

/apps/
  Cache-Control: public, max-age=300, must-revalidate

/apps/*.html
  Cache-Control: public, max-age=3600, must-revalidate

/privacy/
  Cache-Control: public, max-age=86400, must-revalidate

/terms/
  Cache-Control: public, max-age=86400, must-revalidate

/cookies/
  Cache-Control: public, max-age=86400, must-revalidate

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

function generateRedirects(apps) {
  // Track which app slugs were ever published so we can 301 stale URLs.
  // We don't have this history, but we can redirect slugs that AREN'T in current apps.json
  // and that we know were historical: focus-app, quick-scan, photo-editor (the old 4).
  // AstroPrerna is in current apps.json so it must NOT be in the redirect list (otherwise
  // it 301s instead of serving the real per-app page).
  const currentSlugs = new Set((apps || []).map(a => a.slug));
  const historicalSlugs = ['focus-app', 'quick-scan', 'photo-editor'];
  const staleRedirects = historicalSlugs
    .filter(slug => !currentSlugs.has(slug))
    .map(slug => `/apps/${slug}/  /apps/  301`)
    .join('\n');
  return `/admin /admin/ 301

# SEO: 301 redirect stale per-app URLs (apps that no longer exist in apps.json) → /apps/
${staleRedirects}
`;
}

function injectSecrets(html) {
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) {
    console.warn('  ⚠ ADMIN_PASSWORD not set — admin login will not work');
  }
  return html.replace(/__ADMIN_PASSWORD__/g, adminPassword || '');
}

function injectHomeItemList(html, apps) {
  if (apps.length === 0) {
    return html.replace(
      /<script type="application\/ld\+json" id="apps-jsonld"><\/script>\s*/,
      ''
    );
  }
  const itemList = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Dhanuk Softwares — Apps Catalog',
    itemListElement: apps.map((app, idx) => ({
      '@type': 'ListItem',
      position: idx + 1,
      url: `${BASE_URL}/apps/${app.slug}/`,
      name: app.name || ''
    }))
  };
  const json = JSON.stringify(itemList, null, 2).replace(/</g, '\\u003c');
  return html.replace(
    /<script type="application\/ld\+json" id="apps-jsonld"><\/script>/,
    `<script type="application/ld+json">${json}</script>`
  );
}

function injectHomeOrganization(html) {
  const org = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${BASE_URL}/#organization`,
    name: 'Dhanuk Softwares',
    alternateName: 'Dhanuk Software Studio',
    url: BASE_URL + '/',
    logo: {
      '@type': 'ImageObject',
      url: `${BASE_URL}/og-banner.png`,
      width: 1200,
      height: 630
    },
    image: `${BASE_URL}/og-banner.png`,
    description: 'Dhanuk Softwares is an Indian Android app development company building simple, smart, and useful apps for everyday life.',
    email: 'support@dhanuksoftwares.com',
    foundingDate: '2024',
    address: {
      '@type': 'PostalAddress',
      addressLocality: 'Noida',
      addressRegion: 'Uttar Pradesh',
      addressCountry: 'IN'
    },
    contactPoint: [{
      '@type': 'ContactPoint',
      contactType: 'customer support',
      email: 'support@dhanuksoftwares.com',
      availableLanguage: ['English', 'Hindi']
    }],
    founder: {
      '@type': 'Person',
      name: 'Aasheesh Singh',
      jobTitle: 'Founder & Owner'
    },
    areaServed: { '@type': 'Country', name: 'India' },
    knowsAbout: ['Android Development', 'Kotlin', 'Java', 'Mobile Apps', 'Astrology Apps', 'Productivity Apps', 'Document Scanning', 'Photo Editing'],
    sameAs: [
      'https://github.com/aasheesh333',
      'https://twitter.com/dhanuksoftwares',
      'https://www.linkedin.com/company/dhanuksoftwares'
    ]
  };
  const json = JSON.stringify(org, null, 2).replace(/</g, '\\u003c');
  return html.replace(
    /<script type="application\/ld\+json" id="org-jsonld"><\/script>/,
    `<script type="application/ld+json">${json}</script>`
  );
}

function injectHomeWebSiteSchema(html) {
  const website = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${BASE_URL}/#website`,
    name: 'Dhanuk Softwares',
    url: BASE_URL + '/',
    description: 'Dhanuk Softwares is an Indian Android app development company building simple, smart, and useful apps for everyday life.',
    inLanguage: 'en-IN',
    publisher: {
      '@id': `${BASE_URL}/#organization`
    },
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${BASE_URL}/apps/?q={search_term_string}`
      },
      'query-input': 'required name=search_term_string'
    }
  };
  const json = JSON.stringify(website, null, 2).replace(/</g, '\\u003c');
  return html.replace(
    /<script type="application\/ld\+json" id="site-jsonld"><\/script>/,
    `<script type="application/ld+json">${json}</script>`
  );
}

function injectHomeAppsList(html, apps) {
  // SEO: server-side render the #app-count-stat value + a <noscript> list of all apps
  // so crawlers and JS-disabled users see the apps without needing JS execution.
  if (apps.length === 0) {
    // Empty state — replace loading placeholder with a search-engine-readable message
    return html
      .replace(/<div class="stat-num" id="app-count-stat">[^<]*<\/div>/, '<div class="stat-num" id="app-count-stat">0</div>')
      .replace(/<div class="apps-loading loading-pulse">Loading apps[^<]*<\/div>/,
        '<div class="empty-state-block"><p>No apps published yet — check back soon.</p></div>');
  }

  // SSR count in stats box
  html = html.replace(/<div class="stat-num" id="app-count-stat">[^<]*<\/div>/,
    `<div class="stat-num" id="app-count-stat">${apps.length}+</div>`);

  // SSR noscript + JS-rendered cards
  const cards = apps.map(a => `<a class="app-card" href="/apps/${a.slug}/">
      ${a.icon ? `<img class="app-icon-img" src="${escapeHtml(a.icon)}" alt="${escapeHtml(a.name)}" loading="lazy" width="56" height="56"/>` : `<div class="app-emoji">${escapeHtml(a.emoji || '📱')}</div>`}
      <div class="app-name">${escapeHtml(a.name)}</div>
      <div class="app-desc">${escapeHtml(a.shortDesc || '')}</div>
      <div class="app-footer"><span class="app-tag">${escapeHtml(a.category || a.tag || 'Android')}</span></div>
    </a>`).join('\n    ');

  return html.replace(
    /<div class="apps-loading loading-pulse">Loading apps[^<]*<\/div>/,
    `${cards}\n    <noscript><p style="text-align:center;color:var(--muted);padding:2rem;">JavaScript is required to display the app cards dynamically. <a href="/apps/">View all apps</a>.</p></noscript>`
  );
}

main().catch(e => { console.error(e); process.exit(1); });
