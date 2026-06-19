# AGENTS.md

Repo: Dhanuk Softwares portfolio site (https://dhanuksoftwares.com).
Stack: static HTML/CSS/JS + Node 22 build script + Cloudflare Pages Functions. No package.json, no npm install, no node_modules.

## Build & test

```
node --test tests/                                       # 14 unit tests, must pass before commit
ADMIN_PASSWORD=... node build.mjs                       # build to dist/ (env required for admin login)
wrangler pages deploy dist --project-name=dhanuksoftwares --branch=main --commit-dirty=true
```

`build.mjs` reads `apps.json` + `template.html` and emits `dist/apps/{slug}/index.html`, `dist/apps/index.html`, `dist/sitemap.xml`, `dist/robots.txt`, `dist/_headers`, `dist/_redirects`. It also copies `app-ads.txt`, `CNAME`, and `apps.json` to `dist/` — **`apps.json` MUST be in dist or admin breaks** (admin loads it via `fetch('../apps.json')`).

`wrangler.jsonc` declares `pages_build_output_dir: "./dist"` and `compatibility_flags: ["nodejs_compat"]` (Functions need it for `btoa`, etc.). No package.json — wrangler is a global CLI install.

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

## Cloudflare Pages Functions

`functions/api/` (Pages Functions, V8 isolate runtime, `nodejs_compat` flag enabled):
- `ai-fill.js` — POST `/api/ai-fill`. Groq `llama-3.3-70b-versatile` for SEO copy. Optional `playStoreUrl` triggers a Play Store scrape (returns `data.scraped` with name, tagline, icon, 6 screenshots, rating, downloads, updated, developer, category).
- `publish.js` — POST `/api/publish`. Commits `apps.json` to GitHub via REST API, then triggers a Pages deployment via `POST /accounts/{id}/pages/projects/{name}/deployments` so the admin "Save & Deploy" button end-to-end publishes without a manual CLI run. Works whether or not Pages Git integration is configured.
- `track-download.js` — POST `/api/track-download`. Logs to Cloudflare Workers tail/logs only (no DB). Returns 200, not 204 — keeps parity with the old Netlify gotcha and avoids any edge runtime Response-constructor surprises.

**Auth:** all three require `x-admin-token` header = `env.ADMIN_PASSWORD`.

**Required env vars (set in Cloudflare Pages project → Settings → Environment variables, production):**
`ADMIN_PASSWORD`, `GROQ_API_KEY`, `GITHUB_TOKEN`, `GITHUB_REPO` (default `aasheesh333/dhanuksoftwares`), `GITHUB_BRANCH` (default `main`), `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN` (with `Cloudflare Pages: Edit`), `PAGES_PROJECT` (default `dhanuksoftwares`). The CF token + account ID are only needed for publish.js's auto-deploy trigger.

## Admin password — build-time injection (never hardcoded in source)

`docs/admin.html` contains the placeholder `__ADMIN_PASSWORD__` on the line `const ADMIN_PASSWORD = "..."`. `build.mjs` `injectSecrets()` replaces it from `process.env.ADMIN_PASSWORD` when writing to `dist/admin/index.html` and `dist/docs/admin.html`.

- **Source repo:** contains only the placeholder, never the real password.
- **Cloudflare Pages env:** `ADMIN_PASSWORD` set to the actual password (encrypted, never returned by the API).
- **Built output (`dist/`):** contains the real password, baked in at build time. Never committed.

Rotating the password = update Cloudflare Pages env var + rebuild + redeploy. No source edits needed. Without `ADMIN_PASSWORD` set, build prints a warning and emits an empty string — admin login will not work.

## Admin workflow (the gotchas)

1. **Hard refresh required** after deploy — `dist/_headers` sets `Cache-Control: no-cache` on `/admin/*` and `/docs/*` but browsers cache JS aggressively.
2. **Edit/delete are local-only** until "Save & Deploy" is clicked. Clicking ✕ in admin removes from in-memory list only. Must click "Save & Deploy" to actually publish the deletion to GitHub.
3. **Play Store URL fetch** (`/api/ai-fill` with `playStoreUrl`) scrapes name, icon, 6 screenshots, rating, downloads, updated, developer, category, AND injects them into the form. Long description (4000 chars) and FAQ come from Groq.
4. **Admin password source of truth is Cloudflare Pages env**, not the repo. To rotate: update the env var, rebuild, redeploy. No code changes needed.

## Gotchas that have caused real bugs

- **`apps.json` schema migration:** if you add a new field, both admin form (`docs/admin.html` `getFormData()`) and render (`lib/render.mjs`) must handle it. Otherwise saved apps lose the field on next edit.
- **Per-app pages need fresh build** — if you `git push` only `apps.json` without re-running `build.mjs`, the live `/apps/{slug}/` pages won't update on Pages CDN until a build runs (Pages with Git integration runs `node build.mjs` automatically on push).
- **`track-download.js` returns 200, not 204** — historical Netlify Edge runtime threw on 204. Pages Functions handle 204 fine, but keeping 200 is the conservative choice and matches the original semantics.
- **No package.json** — this is intentional. Don't `npm init`. The only dependencies are `node:fs`, `node:path`, `node:test`, `node:assert/strict` (all built-in). Wrangler is a global system CLI, not a project dep.
- **CNAME file** must stay in `dist/` root. `build.mjs` copies it. Pages reads it as a hint for custom domain binding when the zone is on Cloudflare DNS (but custom domains are normally configured in the dashboard, not via the CNAME file).
- **`app-ads.txt`** must stay in `dist/` root. Google AdSense verification depends on it.
- **`_headers` / `_redirects`** are emitted by `build.mjs` into `dist/` (not project root). Pages reads them from the publish directory. Don't move them to project root — Pages won't see them.
- **Build needs `ADMIN_PASSWORD` in env**, otherwise admin login is broken (empty string injected). For Pages Git integration, set `ADMIN_PASSWORD` as a build environment variable in the dashboard.
- **`wrangler pages secret put` from CLI is unreliable over piped stdin** (empty value gets stored). Prefer setting secrets via the dashboard, or PATCH the project env_vars directly via the Cloudflare API (see commit history for the exact PATCH shape with `wrangler_config_hash`).

## Live infrastructure

- Custom domain: `dhanuksoftwares.com` (DNS currently on Netlify; to migrate, add zone to Cloudflare then attach as Pages custom domain)
- Cloudflare Pages URL: `https://dhanuksoftwares.pages.dev`
- Cloudflare account ID: `7fb570ac615a8e2a41a6aff7913114d5`
- Pages project: `dhanuksoftwares` (production branch `main`)
- GitHub repo: `aasheesh333/dhanuksoftwares` (main branch)
- Admin: `https://dhanuksoftwares.pages.dev/admin/` (password set via Pages env `ADMIN_PASSWORD`)

### One-time setup remaining (manual, in dashboard)

1. **Git integration (optional but recommended):** Pages project → Settings → Builds → Connect to Git → pick `aasheesh333/dhanuksoftwares` → production branch `main` → build command `node build.mjs` → output dir `dist`. Also add `ADMIN_PASSWORD` (and any other build-needed vars) as build environment variables. After this, `git push` auto-builds and deploys.
2. **Custom domain:** Add `dhanuksoftwares.com` zone to Cloudflare (change nameservers at registrar), then in Pages project → Custom domains → add `dhanuksoftwares.com`. DNS auto-configures.

## Specs & plans (for context)

- `docs/superpowers/specs/2026-06-17-per-app-seo-design.md` — design rationale
- `docs/superpowers/plans/2026-06-17-per-app-seo.md` — implementation plan with task history
- `docs/superpowers/specs/2026-06-17-admin-page-design.md` — original admin design

Don't modify these unless revisiting the design itself.