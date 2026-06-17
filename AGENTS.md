# AGENTS.md

Repo: Dhanuk Softwares portfolio site (https://dhanuksoftwares.com).
Stack: static HTML/CSS/JS + Node 22 build script + Netlify Functions. No package.json, no npm install, no node_modules.

## Build & test

```
node --test tests/                    # 14 unit tests, must pass before commit
node build.mjs                        # build to dist/
netlify deploy --dir=dist --prod      # deploy (Netlify CLI auth already set)
```

`build.mjs` reads `apps.json` + `template.html` and emits `dist/apps/{slug}/index.html`, `dist/apps/index.html`, `dist/sitemap.xml`, `dist/robots.txt`. It also copies `app-ads.txt`, `CNAME`, and `apps.json` to `dist/` — **`apps.json` MUST be in dist or admin breaks** (admin loads it via `fetch('../apps.json')`).

`netlify.toml` sets `command = "node build.mjs"`, `publish = "dist"`, `functions = "netlify/functions"`. Don't change these unless you know what you're doing.

## Tests

Three test files in `tests/`:
- `slug.test.mjs` — slug generation
- `migrate.test.mjs` — old→new apps.json schema migration
- `render.test.mjs` — HTML rendering of per-app page

Run all: `node --test tests/slug.test.mjs tests/migrate.test.mjs tests/render.test.mjs`. Always run before committing changes to `lib/`, `template.html`, or `apps.json` schema.

## apps.json schema

Two formats exist. Old (4 fixed URL fields) is auto-migrated to new (`marketplaces[]` array) by `lib/migrate.mjs` on every build. **Never edit old-format fields manually** — they get stripped.

New format keys (see an existing entry for the full shape):
`name, slug, tagline, shortDesc, longDescription, emoji, icon, tag, category, keywords[], features[], faq[{q,a}], screenshots[], rating{value,count}, marketplaces[{name,url,type}], lastUpdated`

`type` is the marketplace id (`play`, `uptodown`, `oppo`, `vivo`, `huawei`, `samsung`, `amazon`, `xiaomi`, `apple`, `direct`, `custom`). For custom labels the admin uses the type `custom`.

## Template placeholders

`template.html` uses these (rendered by `lib/render.mjs`):
- `{{name}}`, `{{slug}}`, `{{tagline}}`, `{{shortDesc}}`, `{{longDescription}}`, `{{keywordsString}}`, `{{emoji}}`, `{{icon}}`, `{{category}}`, `{{lastUpdated}}`, `{{primaryScreenshot}}`
- `{{primaryDownloadUrl}}`, `{{primaryMarketplaceName}}`, `{{primaryMarketplaceType}}` (set to mailto if no marketplaces)
- `{{#each features/faq/screenshots/relatedApps/secondaryDownloads/finalSecondaryDownloads}}...{{/each}}` blocks
- `{{#if hasSecondaryDownloads/features.length/faq.length/relatedApps.length/hasRating/hasPrimaryDownload/lastUpdated/primaryDownloadUrl/icon}}...{{/if}}` blocks
- `{{schemaSoftwareApp}}`, `{{schemaFAQ}}`, `{{schemaBreadcrumb}}` (JSON-LD slots)

If you add a new `{{...}}` placeholder, also handle it in `lib/render.mjs` `renderApp()` — otherwise it ships as literal text in HTML.

## Netlify Functions

`netlify/functions/` (ES modules, Node 22 runtime, `node_bundler = "esbuild"` in netlify.toml):
- `ai-fill.js` — POST `/api/ai-fill`. Groq `llama-3.3-70b-versatile` for SEO copy. Optional `playStoreUrl` triggers a Play Store scrape (returns `data.scraped` with name, tagline, icon, 6 screenshots, rating, downloads, updated, developer, category).
- `publish.js` — POST `/api/publish`. Commits `apps.json` to GitHub via REST API, then triggers Netlify deploy via API or build hook.
- `track-download.js` — POST `/api/track-download`. Logs to Netlify function logs only (no DB). Returns 200 (not 204 — 204 breaks the Response constructor).

**Auth:** all three require `x-admin-token` header = `ADMIN_PASSWORD` env var (default `Dhanuk@2025`).

**Required env vars (set in Netlify UI, production context):**
`ADMIN_PASSWORD`, `GROQ_API_KEY`, `GITHUB_TOKEN`, `GITHUB_REPO` (default `aasheesh333/dhanuksoftwares`), `GITHUB_BRANCH` (default `main`), `NETLIFY_SITE_ID`, optional `NETLIFY_API_TOKEN`, `NETLIFY_BUILD_HOOK`.

## Admin workflow (the gotchas)

1. **Hard refresh required** after deploy — `netlify.toml` sets `Cache-Control: no-cache` on `/admin/*` and `/docs/*` but browsers cache JS aggressively.
2. **Edit/delete are local-only** until "Save & Deploy" is clicked. Clicking ✕ in admin removes from in-memory list only. Must click "Save & Deploy" to actually publish the deletion to GitHub.
3. **Play Store URL fetch** (`/api/ai-fill` with `playStoreUrl`) scrapes name, icon, 6 screenshots, rating, downloads, updated, developer, category, AND injects them into the form. Long description (4000 chars) and FAQ come from Groq.
4. **Admin password** is hardcoded in `docs/admin.html:411` as `"Dhanuk@2025"` AND must match the `ADMIN_PASSWORD` env var used by functions. Change both places.

## Gotchas that have caused real bugs

- **`apps.json` schema migration:** if you add a new field, both admin form (`docs/admin.html` `getFormData()`) and render (`lib/render.mjs`) must handle it. Otherwise saved apps lose the field on next edit.
- **Per-app pages need fresh build** — if you `git push` only `apps.json` without re-running `build.mjs`, the live `/apps/{slug}/` pages won't update on Netlify CDN until a build runs.
- **`track-download.js` MUST return 200, not 204** — the Netlify Edge runtime's Response constructor throws on 204. Symptom: 502 errors in admin network tab.
- **No package.json** — this is intentional. Don't `npm init`. The only dependencies are `node:fs`, `node:path`, `node:test`, `node:assert/strict` (all built-in).
- **CNAME file** must stay in `dist/` root. `build.mjs` copies it. Netlify reads it for custom domain binding.
- **`app-ads.txt`** must stay in `dist/` root. Google AdSense verification depends on it.

## Live infrastructure

- Custom domain: `dhanuksoftwares.com` (Netlify-managed DNS, SSL auto)
- Netlify URL: `https://dhanuksoftwares.netlify.app`
- Netlify site ID: `340e532b-30a2-4038-8cb9-3e36eb82b1a9`
- Netlify team: `Dhanuk` (Free plan, ~75% bandwidth headroom remaining)
- GitHub repo: `aasheesh333/dhanuksoftwares` (main branch)
- Admin: `https://dhanuksoftwares.com/admin/` (password: `Dhanuk@2025`)

## Specs & plans (for context)

- `docs/superpowers/specs/2026-06-17-per-app-seo-design.md` — design rationale
- `docs/superpowers/plans/2026-06-17-per-app-seo.md` — implementation plan with task history
- `docs/superpowers/specs/2026-06-17-admin-page-design.md` — original admin design

Don't modify these unless revisiting the design itself.
