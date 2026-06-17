# Per-App SEO Pages + AI Auto-fill — Design

**Date:** 2026-06-17
**Status:** Approved by user through brainstorming session — ready for implementation
**Site:** https://dhanuksoftwares.netlify.app

## 1. Problem

Current setup: single `index.html` + `apps.json` (4 apps). Every app shares one URL, so apps can never rank individually on Google. Owner cannot add apps frequently (manual GitHub edits). Content is generic — no per-app SEO targeting "best [category] app India" type queries. No AI assistance for writing SEO content.

## 2. Goal

Build a system where:

1. Every app has its own static HTML page at `/apps/{slug}.html` (own URL, own SEO, own Google ranking).
2. Admin (`/admin`) lets owner add/edit/delete apps via a form, with extended SEO fields.
3. Groq AI (`llama-3.3-70b-versatile`, free) auto-fills SEO content (tagline, meta description, long description, keywords, features, FAQ) from a short seed description. User can edit before saving.
4. Admin "Save & Deploy" auto-commits `apps.json` to GitHub → Netlify auto-rebuilds → per-app pages auto-generate from a template.
5. Marketplaces are **fully flexible** — any combination of 0-10+ stores (Play, Uptodown, OPPO, Vivo, Huawei, Samsung, Amazon, Xiaomi, Apple, Direct APK, Custom). No Play Store assumption.
6. Pages are **conversion-focused** (1000-1500 words, sticky download bar, multiple CTAs, UTM tracking) — primary metric is marketplace installs, not just page rank.

## 3. Non-Goals

- Not building a full CMS (admin is single-user, password-gated, no multi-user).
- Not generating real app screenshots (user provides URL list).
- Not auto-publishing to Play Store (out of scope).
- Not building a mobile app (this is the website).
- Not supporting image uploads to Netlify (icons/screenshots are URL-referenced).
- Not implementing user accounts / signup.
- Not supporting multiple languages per page in v1 (English only; Hinglish allowed in content).

## 4. Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ ADMIN PANEL (docs/admin.html, password protected)           │
│  - Login: password "Dhanuk@2025"                            │
│  - Form: name, slug, category, seed description,            │
│          icon URL, marketplaces[], rating, screenshots[]   │
│  - "✨ AI Auto-fill All" button                              │
│      ↓ POST /api/ai-fill (Netlify Function)                 │
│      ↓ Function validates admin session cookie              │
│      ↓ Function calls Groq (key from env var)               │
│      ↓ Returns: tagline, shortDesc, longDescription,        │
│                 keywords[], features[], faq[]                │
│  - User reviews/edits                                       │
│  - "Save & Deploy" button                                   │
│      ↓ POST /api/publish (Netlify Function)                 │
│      ↓ Function commits apps.json to GitHub via REST API    │
│      ↓ GitHub webhook → Netlify build triggered             │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ NETLIFY BUILD (build.mjs, runs on every push)               │
│  1. Read apps.json (extended schema)                        │
│  2. For each app:                                           │
│     - Render /apps/{slug}.html from template.html           │
│       + app data + AI-expanded page sections                │
│  3. Generate /sitemap.xml (all apps + home)                 │
│  4. Generate /robots.txt                                    │
│  5. Copy index.html, admin.html, assets                     │
│  6. Deploy to CDN                                           │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ VISITOR (public)                                            │
│  - /                       → home page (apps grid)          │
│  - /apps/{slug}.html       → per-app page (1000-1500 words) │
│  - /admin                  → 301 → /docs/admin.html         │
│  - /sitemap.xml            → Google indexing                │
│  - /robots.txt             → crawler config                 │
└─────────────────────────────────────────────────────────────┘
```

## 5. Data Model — `apps.json` (extended schema)

```json
{
  "name": "AstroPrerna",
  "slug": "astroprerna",
  "tagline": "Your personal astrology companion",
  "shortDesc": "Free daily horoscope, Kundli, and Rashifal in Hindi & English.",
  "longDescription": "AstroPrerna is the most accurate...",
  "emoji": "🔭",
  "icon": "https://dhanuksoftwares.com/icons/astroprerna.png",
  "tag": "Astrology",
  "category": "Lifestyle",
  "keywords": ["astrology app india", "daily horoscope", "kundli free", "rashifal hindi"],
  "features": [
    "Daily personalised horoscope in Hindi & English",
    "Free Kundli generation with Vimshottari Dasha",
    "Marriage compatibility matching",
    "Offline mode after first sync",
    "No ads in core features"
  ],
  "screenshots": [
    "https://dhanuksoftwares.com/screens/astroprerna-1.png"
  ],
  "faq": [
    {"q": "Is AstroPrerna free?", "a": "Yes, 100% free with no hidden charges."}
  ],
  "rating": {"value": 4.6, "count": 1240},
  "marketplaces": [
    {"name": "Google Play", "url": "https://play.google.com/...id=com.dhanuk.astroprerna", "type": "play"},
    {"name": "Direct APK", "url": "https://dhanuksoftwares.com/downloads/astroprerna.apk", "type": "direct"}
  ],
  "lastUpdated": "2026-06-15"
}
```

**Validation rules (admin form):**
- `name`: required, 1-80 chars
- `slug`: required, auto-generated from name (kebab-case, unique), 1-60 chars
- `tagline`: 0-60 chars
- `shortDesc`: required, 0-160 chars (meta description)
- `longDescription`: required, 200-2000 chars
- `keywords`: 0-10 tags, each ≤ 40 chars
- `features`: 0-12 items
- `faq`: 0-12 Q/A
- `screenshots`: 0-10 URLs
- `marketplaces`: 0-20 entries, each with name + URL
- `rating.value`: 0-5, `rating.count`: ≥ 0
- No required Play Store URL — any combination of 0-20 marketplaces is valid

## 6. Admin Form — `docs/admin.html` (extended)

**Existing fields kept:** name, category, desc, emoji, icon, playUrl, uptodownUrl, oppoUrl, vivoUrl, login

**New fields added:**

| Section | Fields | Notes |
|---|---|---|
| Identity | name, slug (auto), category, tagline | Slug auto-derives from name, editable |
| SEO | shortDesc (with char counter 0/160), keywords (chip input), longDescription (with char counter 0/2000) | AI-fillable |
| Visual | emoji, icon URL, screenshots[] (dynamic add/remove rows) | |
| Marketplaces | Dynamic list — name + URL, +Add button, pre-filled suggestions | Replaces fixed 4 URL fields |
| Features | Dynamic bullet list, +Add row | AI-fillable |
| FAQ | Dynamic Q/A rows, +Add row | AI-fillable |
| Trust | rating value, rating count, lastUpdated (date) | |
| Actions | ✨ AI Auto-fill All, 🔄 Regenerate (per section), Save & Deploy, Clear | |

**AI flow (admin side):**
1. User fills `name`, `category`, `short description for AI seed` (3+ words)
2. Clicks "✨ AI Auto-fill All"
3. POST to `/.netlify/functions/ai-fill` with `{name, category, seed}` and `x-admin-token` header
4. Function validates token (matches `ADMIN_PASSWORD` env var or hardcoded fallback)
5. Function calls Groq with system prompt (see §7) + user payload
6. Returns JSON: `{tagline, shortDesc, longDescription, keywords[], features[], faq[]}`
7. Form auto-populates fields
8. User can edit/regenerate individual sections
9. User clicks "Save & Deploy"

**Migration:** existing 4 fixed URL fields (`playUrl`, `uptodownUrl`, `oppoUrl`, `vivoUrl`) auto-converted to `marketplaces[]` on first save of an app. Old apps in `apps.json` migrated via build script.

## 7. Groq AI Specs

- **Model:** `llama-3.3-70b-versatile` (free tier, 14,400 req/day, ~600 tokens/sec)
- **Temperature:** 0.7
- **Max tokens:** 3000
- **API key:** Netlify env var `GROQ_API_KEY` (already set)
- **Rate limit (admin):** 5 calls/min per session
- **System prompt (locked):**

```
You are an expert SEO copywriter for an Indian Android app studio called Dhanuk Softwares.
You write content that ranks on Google India search results.

Rules:
- Target position #1 for: [app category] + Indian audience long-tail keywords
- Use LSI keywords naturally (no stuffing)
- Mix English with Hindi terms where natural (e.g., "Kundli", "Rashifal")
- Follow E-E-A-T (Experience, Expertise, Authority, Trust)
- Write in active voice, second person ("you")
- Output strict JSON only, no markdown, no preamble
- Schema.org friendly (SoftwareApplication, FAQPage, BreadcrumbList)
- Reads human-written, not AI-generated
- Lengths: tagline ≤60 char, shortDesc ≤160 char, longDescription 400-700 words

Return JSON shape:
{
  "tagline": "...",
  "shortDesc": "...",
  "longDescription": "...",
  "keywords": ["...", "..."],
  "features": ["...", "..."],
  "faq": [{"q":"...","a":"..."}, ...]
}
```

**Two AI calls per app save:**
- Call 1 (admin time): meta content for form fields (user reviews)
- Call 2 (build time): page section expansions (hidden from user, automated)

## 8. Per-App Page Template — `template.html`

**Sections (top → bottom, 1000-1500 words total):**

| # | Section | Words | Schema |
|---|---|---|---|
| 1 | HERO (icon, name, tagline, rating, primary CTA, secondary CTAs) | 30 | — |
| 2 | ABOUT (longDescription expanded with H2 sub-headings) | 300-400 | — |
| 3 | KEY FEATURES (6-8 features, each with 1-2 line explanation) | 200-300 | — |
| 4 | SCREENSHOTS GALLERY (5-6 images with keyword-rich alt text) | 50 | — |
| 5 | HOW TO DOWNLOAD (3-step guide, mentions all marketplaces) | 150 | — |
| 6 | FAQ (5-6 Q/A) | 200-300 | `FAQPage` |
| 7 | TECH DETAILS + RATING (version, size, installs, languages, updated) | 100 | — |
| 8 | DOWNLOAD NOW — FINAL CTA (all marketplace buttons) | 30 | — |

**Sticky download bar (mobile):** fixed bottom bar with primary marketplace button + "More stores" dropdown. Always visible on scroll.

**Sticky header CTA (desktop):** top-right "Download" button.

**Conversion elements:**
- 5+ marketplace CTA placements per page
- Primary marketplace = first in user's list (not hardcoded to Play)
- UTM parameters on every link: `?utm_source=dhanuksoftwares&utm_medium=website&utm_campaign=app_page&utm_content={slug}&utm_term={marketplace}`
- `onclick` tracking calls `/api/track-download` Netlify function
- Exit-intent popup (desktop, 5s delay, dismissable)

**SEO elements:**
- `<title>`: `{name} - {tagline} | Dhanuk Softwares`
- `<meta description>`: `shortDesc`
- `<link rel="canonical">`: self
- Open Graph + Twitter Card with screenshot
- `robots`: `index, follow, max-image-preview:large, max-snippet:-1`
- JSON-LD: `SoftwareApplication` + `FAQPage` + `BreadcrumbList` + `Organization`
- Cross-links to home + all other apps in footer

## 9. Netlify Functions

### `/.netlify/functions/ai-fill`
- **Method:** POST
- **Auth:** `x-admin-token` header must equal `ADMIN_PASSWORD` (env var, default "Dhanuk@2025")
- **Body:** `{name, category, seed}`
- **Returns:** `{tagline, shortDesc, longDescription, keywords[], features[], faq[]}`
- **Rate limit:** 5/min per IP (in-memory)
- **Errors:** 401 (bad token), 429 (rate limit), 502 (Groq error), 400 (missing fields)

### `/.netlify/functions/publish`
- **Method:** POST
- **Auth:** `x-admin-token` header
- **Body:** `apps[]` (full apps.json content)
- **Action:** commits to `apps.json` on GitHub via REST API (uses `GITHUB_TOKEN` env var)
- **Returns:** `{ok: true, commitSha, deployHookTriggered}`

### `/.netlify/functions/track-download`
- **Method:** POST
- **Body:** `{app, marketplace, source}` (e.g., "hero_button", "sticky_bar")
- **Action:** logs to Netlify function logs (can be queried later, no DB in v1)
- **No auth** (public — just tracking)

## 10. Build Pipeline — `build.mjs` (Netlify build)

Runs on every push to `main`. Steps:

1. Read `apps.json` (extended schema, validated)
2. Read `template.html` (per-app page template)
3. For each app:
   - Generate slug → `/apps/{slug}/index.html` (cleaner URLs than `.html`)
   - Substitute `{{var}}` placeholders with app data
   - Inject JSON-LD blocks
   - Add cross-link footer to all other apps
4. Render `/index.html` (home, app grid with marketplace pills + ratings)
5. Generate `/sitemap.xml` (all apps + home + admin)
6. Generate `/robots.txt` (allow all, point to sitemap, disallow /admin)
7. Generate `/apps/index.html` (apps index page, all apps listed)
8. Copy static assets: `app-ads.txt`, `CNAME`, `icons/`, `screens/`
9. Output to `dist/` (Netlify publishes this)

**Output structure:**
```
dist/
  index.html
  apps/
    index.html
    astroprerna/index.html
    focus-app/index.html
    quick-scan/index.html
    photo-editor/index.html
  admin/
    index.html (copy of docs/admin.html)
  docs/
    admin.html (legacy redirect target)
  sitemap.xml
  robots.txt
  app-ads.txt
  CNAME
  icons/
  screens/
```

## 11. Configuration

**Netlify env vars (set):**
- `GROQ_API_KEY` (already set) — for AI fill function
- `ADMIN_PASSWORD` — to be set (defaults to "Dhanuk@2025" in code, can override)
- `GITHUB_TOKEN` — to be set (for publish function, PAT with `repo` scope)
- `GITHUB_REPO` — to be set (e.g., "aasheesh333/dhanuksoftwares")

**netlify.toml (updated):**
- Build command: `node build.mjs`
- Publish: `dist`
- Functions directory: `netlify/functions`
- Headers: cache static, security headers
- Redirects: `/admin` → `/admin/` (301)

## 12. Verification (post-deploy)

1. ✓ Visitor home loads: https://dhanuksoftwares.netlify.app (HTTP 200)
2. ✓ Per-app page loads: https://dhanuksoftwares.netlify.app/apps/astroprerna/ (HTTP 200)
3. ✓ Sitemap: https://dhanuksoftwares.netlify.app/sitemap.xml (HTTP 200, valid XML)
4. ✓ Robots: https://dhanuksoftwares.netlify.app/robots.txt (HTTP 200)
5. ✓ Admin login works with password
6. ✓ AI Auto-fill returns valid JSON
7. ✓ Save & Deploy commits to GitHub
8. ✓ Marketplace links work with UTM params
9. ✓ Sticky bar visible on mobile
10. ✓ Schema validates at https://validator.schema.org/

## 13. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Groq free tier rate limit hit | 5/min limit + clear error message + "Regenerate" only on demand |
| GitHub PAT leaked | Stored as Netlify env var, never in code/admin/JSON |
| AI generates bad/wrong content | User reviews in form before save, "Regenerate" buttons |
| Page bloat (admin form too long) | Tabs/accordion sections, progressive disclosure |
| Slug collisions | Admin checks uniqueness, errors if duplicate |
| Existing apps break on schema change | Build script auto-migrates old format on first run |
| Marketplace icon missing for custom type | Fallback to generic download icon |
| Netlify function cold start delay (1-2s) | Acceptable for admin (not visitor), show loading spinner |

## 14. Out-of-Scope (Future)

- Multi-language pages (Hindi/English versions)
- App reviews / testimonials section with user-submitted content
- A/B testing of page layouts
- Analytics dashboard (currently just function logs)
- Email notifications on new downloads
- Backlink management
- Image auto-generation for screenshots
