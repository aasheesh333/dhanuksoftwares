# AGENTS.md

Repo: Dhanuk Softwares portfolio site (https://dhanuksoftwares.com).
Stack: static HTML/CSS/JS + Node 22 build script + Cloudflare Pages Functions. No package.json, no node_modules.

## Build & test

```
node --test tests/slug.test.mjs tests/migrate.test.mjs tests/render.test.mjs   # 14 tests
ADMIN_PASSWORD=... node build.mjs                                              # build to dist/
wrangler pages deploy dist --project-name=dhanuksoftwares --branch=main --commit-dirty=true
```

You MUST run tests before committing changes to `lib/`, `template.html`, or `apps.json` schema.

`build.mjs` reads `apps.json` + `template.html`, emits `dist/apps/{slug}/index.html`, `dist/apps/index.html`, `dist/sitemap.xml`, `dist/robots.txt`, `dist/_headers`, `dist/_redirects`. Copies `app-ads.txt`, `CNAME`, `privacy.html`, `terms.html`, `cookies.html`, `apps.json` to `dist/`. Also injects JSON-LD (Organization, ItemList, WebSite) and SSR app cards into `dist/index.html`.

**`apps.json` MUST be in dist** — admin loads it via `fetch('../apps.json')`.

Wrangler is a global CLI install (no project-local package.json). `wrangler.jsonc` sets `pages_build_output_dir: "./dist"` and `compatibility_flags: ["nodejs_compat"]`.

## Template placeholders (`template.html` → `lib/render.mjs`)

If you add a new `{{...}}` placeholder, add a `html.replace()` in `lib/render.mjs` `renderApp()` — otherwise it ships as literal text. Current vars:
- `{{name}}`, `{{slug}}`, `{{tagline}}`, `{{shortDesc}}`, `{{longDescription}}`, `{{keywordsString}}`, `{{emoji}}`, `{{icon}}`, `{{category}}`, `{{lastUpdated}}`, `{{primaryScreenshot}}`
- `{{primaryDownloadUrl}}`, `{{primaryMarketplaceName}}`, `{{primaryMarketplaceType}}` (mailto if no marketplaces)
- `{{baseUrl}}` — replaced in `build.mjs` with the site base URL
- `{{datePublished}}` — set to `app.datePublished || app.lastUpdated`
- `{{developer}}`, `{{inLanguage}}`, `{{softwareRequirements}}`, `{{appSize}}`, `{{totalDownloads}}`, `{{contentRating}}`, `{{hasStats}}`
- `{{#each features/faq/screenshots/relatedApps/secondaryDownloads/finalSecondaryDownloads}}` blocks
- `{{#if hasSecondaryDownloads/features.length/faq.length/relatedApps.length/hasRating/hasPrimaryDownload/lastUpdated/primaryDownloadUrl/icon}}` blocks
- `{{schemaSoftwareApp}}`, `{{schemaFAQ}}`, `{{schemaBreadcrumb}}` (JSON-LD slots)

## apps.json schema

Old format (4 fixed URL fields) auto-migrated to `marketplaces[]` by `lib/migrate.mjs` every build. **Never edit old-format fields manually** — they get stripped.

New format keys: `name, slug, tagline, shortDesc, longDescription, emoji, icon, tag, category, keywords[], features[], faq[{q,a}], screenshots[], rating{value,count}, marketplaces[{name,url,type}], lastUpdated, datePublished, version, developer, inLanguage, appSize, contentRating, releaseNotes, totalDownloads, softwareRequirements`

`type` values: `play`, `uptodown`, `oppo`, `vivo`, `huawei`, `samsung`, `amazon`, `xiaomi`, `apple`, `direct`, `custom`.

## Cloudflare Pages Functions

`functions/api/` (V8 isolate, `nodejs_compat` flag):
- `login.js` — POST `/api/login`. Constant-time password compare against `env.ADMIN_PASSWORD`. Sets HttpOnly session cookie `ds_session`.
- `ai-fill.js` — POST `/api/ai-fill`. Groq `llama-3.3-70b-versatile` for SEO copy. Optional `playStoreUrl` triggers Play Store scrape.
- `publish.js` — POST `/api/publish`. Commits `apps.json` to GitHub via REST API, then triggers CF Pages deployment.
- `track-download.js` — POST `/api/track-download`. Logs to Workers logs only (no DB). Returns 200, not 204 (historical Netlify compatibility).

**Auth:** all Functions except `login.js` require `x-admin-token` header = `env.ADMIN_PASSWORD`. `login.js` compares password from JSON body.

**Core auth module:** `lib/auth.mjs` — `createSessionToken()`, `verifySessionToken()`, `corsHeaders()`.

**Required env vars (set in CF Pages dashboard → Settings → Environment variables, production):**
`ADMIN_PASSWORD`, `GROQ_API_KEY`, `GITHUB_TOKEN`, `GITHUB_REPO` (default `aasheesh333/dhanuksoftwares`), `GITHUB_BRANCH` (default `main`), `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN` (Pages: Edit), `PAGES_PROJECT` (default `dhanuksoftwares`).

## Admin auth (no build-time injection)

Admin uses API-based login: `docs/admin.html` POSTs to `/api/login` → receives session token → stores in memory for subsequent API calls. There is no `__ADMIN_PASSWORD__` placeholder in the source HTML. `build.mjs` `injectSecrets()` (`__ADMIN_PASSWORD__` replacement) is a **no-op** — the placeholder doesn't exist in admin.html.

`ADMIN_PASSWORD` is a Pages runtime env var consumed by the Functions. It is **not** needed for the build to succeed, but the build emits a misleading warning if it's missing.

## CSS — per-app is external

Per-app pages load `{{baseUrl}}/assets/style.css` (~220 lines). If you add CSS for per-app pages, edit `assets/style.css`, NOT inline in `template.html`. `_headers` caches `/assets/*` for **7 days** — CSS changes may need a cache-busting query string for rapid iteration.

The homepage (`index.html`) has its own inline `<style>` block (separate from per-app CSS).

## Gotchas

- **Homepage cards dual-render:** `build.mjs` `injectHomeAppsList()` injects static `<a>` cards into `index.html`. Then client-side `loadApps()` does `grid.innerHTML = ''` and rebuilds from `apps.json`. The JS version MUST create `<a>` elements (not `<div>`) with `text-decoration: none; color: var(--text)` on `.app-card` CSS — otherwise the card body is non-clickable. If you add or change card markup, fix both the SSR template in `build.mjs` AND the JS template in `index.html`.
- **`apps.json` schema migration:** if you add a new field, handle it in admin form `getFormData()`, `render.mjs`, and `build.mjs` injection. Otherwise saved apps lose the field on next edit.
- **Per-app pages need fresh build** — `git push` of `apps.json` alone won't update per-app pages on CDN until a build runs.
- **`_headers` / `_redirects`** emitted by `build.mjs` into `dist/` (not project root). Pages reads them from the publish directory.
- **`app-ads.txt`** must stay in `dist/` root. Google AdSense verification depends on it.
- **Wrangler `pages secret put`** is unreliable over piped stdin. Set secrets via dashboard or PATCH the API directly.

## Live infrastructure

- Custom domain: `dhanuksoftwares.com` (DNS on Netlify; to migrate, add zone to Cloudflare then attach as Pages custom domain)
- Cloudflare Pages: `https://dhanuksoftwares.pages.dev`
- Account ID: `7fb570ac615a8e2a41a6aff7913114d5`
- Pages project: `dhanuksoftwares` (production branch `main`)
- GitHub: `aasheesh333/dhanuksoftwares` (main branch)
- Admin: `https://dhanuksoftwares.pages.dev/admin/`

## Design docs (don't modify unless revisiting the design)

- `docs/superpowers/specs/2026-06-17-per-app-seo-design.md`
- `docs/superpowers/plans/2026-06-17-per-app-seo.md`
- `docs/superpowers/specs/2026-06-17-admin-page-design.md`
