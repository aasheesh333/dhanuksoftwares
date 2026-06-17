# Admin Page for Dhanuk Softwares Portfolio — Design

**Date:** 2026-06-17
**Author:** opencode brainstorming session
**Status:** Draft — awaiting user approval

## 1. Problem

The current site (`index.html`) loads app cards from a static `apps.json` file in the repo. To add a new app, the owner must:

1. Manually edit `apps.json` in the GitHub web editor (or push from a local clone).
2. Add an icon file, write name, description, tag, and Play Store URL by hand.
3. Get the JSON syntax right (commas, quotes, escaping).
4. Commit and wait for GitHub Pages to redeploy.

This is error-prone and blocks the owner — who is not a developer by trade — from adding apps frequently, which hurts SEO momentum and download growth.

## 2. Goal

Add a self-contained `/admin.html` page on the same GitHub Pages site that:

- Requires a password stored as a GitHub Actions secret named `PASSWORD` (passed in as a build-time injection — see section 5).
- Lets the owner add, edit, and remove apps through a friendly form.
- Lets the owner upload an app icon (PNG/JPG/SVG) that is stored as a base64 data URI inside the apps data blob.
- Lets the owner paste one or more marketplace URLs (Google Play, Huawei AppGallery, Amazon Appstore, Samsung Galaxy Store, GitHub Releases, direct APK/website) per app.
- Lets the owner reorder apps via up/down buttons.
- On save, automatically commits the new `apps.json` to the GitHub repo via the GitHub REST API, so the live site updates on the next Pages deploy.
- Falls back to "Download apps.json" if no GitHub token is configured, so the page is still useful.

## 3. Non-Goals

- Multi-user authentication or per-user permissions.
- Image cropping or resizing (we resize client-side to 256×256 max, then base64-encode).
- App analytics, ratings, or version history.
- Server-side processing. Everything runs in the browser.

## 4. Architecture

```
┌────────────────────┐         ┌────────────────────┐
│   index.html       │         │   admin.html       │
│  (public site)     │         │  (password-gated)  │
│                    │         │                    │
│  fetch apps.json ──┼────┐    │  form, list, save  │
│  render cards      │    │    │  GitHub API commit │
└────────────────────┘    │    │         │          │
                          │    │         ▼          │
                          │    │  ┌──────────────┐   │
                          │    │  │ localStorage │   │
                          │    │  │  (draft)     │   │
                          │    │  └──────────────┘   │
                          ▼    └────────┬───────────┘
                       ┌─────────────────────┐
                       │     apps.json       │
                       │   (in repo root)    │
                       │                     │
                       │ icon = base64 data  │
                       │ stores = {          │
                       │   googlePlay: url,  │
                       │   huawei: url,      │
                       │   ...               │
                       │ }                   │
                       └─────────────────────┘
```

Single page, no frameworks. Vanilla JS + HTML + CSS, matches the existing visual language (dark theme, Syne + DM Sans fonts, same color variables).

## 5. Password Flow — `PASSWORD` Secret

GitHub Pages is a static host. There is no server-side environment to read a secret at request time. Two options were considered:

- **A. Hardcode the password into `admin.html` at build time** via a GitHub Actions workflow that injects it as a `window.__ADMIN_PASSWORD__` variable. The workflow reads the `PASSWORD` secret and rewrites the placeholder in `admin.html` before deploying. **Chosen.**
- B. Use a serverless function (Cloudflare Worker, Vercel). Rejected: extra infra, owner doesn't want it.

### How A works in practice

1. Owner sets `PASSWORD` in **Settings → Secrets and variables → Actions** of the repo.
2. A new workflow `.github/workflows/deploy.yml` runs on push to `main`:
   - Reads the secret.
   - Uses `sed` to replace the literal string `__ADMIN_PASSWORD_INJECTED_AT_BUILD__` in `admin.html` with the secret value.
   - Uploads the entire repo to the `gh-pages` branch via `actions/deploy-pages`.
3. The deployed `admin.html` contains the password as a JS string literal. The owner visits `https://dhanuksoftwares.com/admin.html`, types the password, gets in.
4. **Security note:** Anyone who views the page source can see the password. This is acceptable for this owner because the password's job is to prevent *casual* editing and accidental public discovery, not to protect state secrets. The repo itself is public, so the password is not a true secret in the cryptographic sense — it is a shared gate. We will document this clearly in the admin page footer.

### Login UX

- First visit: a centered card with one input and a Submit button.
- On submit, JS compares input to `window.__ADMIN_PASSWORD__` using a constant-time string compare.
- If correct: show the admin UI and persist `dhs_admin_ok=1` in `localStorage` for 7 days.
- If incorrect: shake animation, clear input, show "Wrong password" for 1.5s.
- A "Log out" button in the admin header clears the flag.

## 6. Admin Page UI

### 6.1 Header bar (same style as public site nav)

- Left: "Dhanuk Admin" in Syne 800.
- Right: "View live site ↗" link and "Log out" button.

### 6.2 Stats row

- Total apps count.
- Last saved timestamp.
- GitHub connection status (Connected as `<username>` / Not connected — see 6.5).

### 6.3 App list panel (left, 40% width on desktop, stacked on mobile)

For each app, a card showing:
- Thumbnail (from base64 or empty placeholder).
- Name.
- Tag.
- Number of store links configured.
- Buttons: ✎ Edit, ↑ Up, ↓ Down, 🗑 Delete (with confirm).

A "+ Add new app" button at the bottom of the list.

### 6.4 App form panel (right, 60% width on desktop, full width on mobile)

When editing/adding, the form contains:

| Field | Type | Notes |
|---|---|---|
| App name | text | required, max 60 chars |
| Tag | text | short category label, e.g. "Productivity" |
| Description | textarea | max 280 chars, char counter |
| Icon | file input (PNG/JPG/SVG) | resized to 256×256 canvas, base64-encoded into data URI |
| Google Play URL | url | optional |
| Huawei AppGallery URL | url | optional |
| Amazon Appstore URL | url | optional |
| Samsung Galaxy Store URL | url | optional |
| GitHub Releases URL | url | optional |
| Direct APK / Website URL | url | optional |
| Hidden / Draft | checkbox | if on, app is stored but not shown on public site |

Buttons at bottom: **Save draft** (saves to localStorage only), **Save & publish** (commits to GitHub), **Cancel**.

### 6.5 GitHub connection

The owner configures once:
- GitHub Personal Access Token (classic, with `repo` scope).
- Repo owner + name (default: `aasheesh333/dhanuksoftwares`).
- Target branch (default: `main`).

These are stored in `localStorage` only, never sent anywhere except `api.github.com`. The token is masked in the UI (`ghp_****xxxx`) after entry.

A "Test connection" button calls `GET /user` to confirm.

## 7. Save & Publish Flow

1. Owner clicks **Save & publish**.
2. JS serializes the apps array to pretty-printed JSON.
3. JS calls `GET /repos/{owner}/{repo}/contents/apps.json` to get the current file's SHA (required for updates).
4. JS calls `PUT /repos/{owner}/{repo}/contents/apps.json` with:
   ```json
   {
     "message": "Update apps list via admin",
     "content": "<base64 of new apps.json>",
     "sha": "<existing sha>"
   }
   ```
5. GitHub triggers the Pages deploy workflow.
6. Within ~30–60 seconds, `dhanuksoftwares.com` shows the new app list.
7. Admin shows a success toast with a link to the live site.

If the file does not exist yet (first save), the SHA is omitted.

## 8. Public Site Changes (`index.html`)

Minimal, surgical changes:

- `loadApps()` already supports reading `emoji`, `name`, `desc`, `tag`, `playUrl`. Extend it to:
  - Prefer `icon` (base64) over `emoji` if present.
  - Build a single primary CTA button (Google Play) and a "more stores" dropdown if other store URLs exist.
- Add a `<link rel="alternate" type="application/json" href="/apps.json">` for crawler discovery.
- No layout changes otherwise.

The dropdown is a small `<details>` element styled to match the dark theme, with one link per configured store, each with a tiny inline icon (SVG, inline) to identify the marketplace.

## 9. Data Shape

`apps.json` will now look like:

```json
[
  {
    "id": "astroprerna",
    "name": "AstroPrerna",
    "tag": "Astrology",
    "desc": "Your personal astrology companion…",
    "icon": "data:image/png;base64,iVBORw0KGgo…",
    "stores": {
      "googlePlay": "https://play.google.com/store/apps/details?id=…",
      "huawei": "",
      "amazon": "",
      "samsung": "",
      "github": "",
      "website": ""
    },
    "draft": false,
    "order": 0
  }
]
```

The `id` is a slug derived from the name (lowercase, alphanumeric + dashes) so the admin can stably reference apps.

For backward compatibility, `loadApps()` will still read the old shape (`emoji`, `playUrl`) and convert on the fly. Old entries are migrated to the new shape on first save from the admin page.

## 10. SEO Impact (bonus, not in original request)

While touching `index.html`, add:

- `<link rel="canonical" href="https://dhanuksoftwares.com/">`
- Open Graph + Twitter Card meta tags pointing at a default banner (we'll use a simple SVG data URI to avoid adding an image file).
- JSON-LD `SoftwareApplication` items in a `<script type="application/ld+json">` block, one per app, including `name`, `description`, `applicationCategory`, `operatingSystem`, `url`, and `downloadUrl` (Google Play).
- A `sitemap.xml` and `robots.txt` in the repo root.

These are not in scope for the brainstormed feature, but the user mentioned SEO earlier, so we include them as a small extra while we're already in the file.

## 11. Files Added / Changed

| File | Action | Purpose |
|---|---|---|
| `admin.html` | **new** | The admin page itself |
| `index.html` | edit | Read new apps.json shape, render icon + multi-store, add SEO meta + JSON-LD |
| `apps.json` | edit (auto) | Migrate to new shape on first admin save |
| `.github/workflows/deploy.yml` | **new** | Inject `PASSWORD` secret into `admin.html`, then deploy via `actions/deploy-pages` |
| `sitemap.xml` | **new** | Static sitemap listing the home page |
| `robots.txt` | **new** | Allow all, point to sitemap |

## 12. Error Handling

- Wrong password: shake + clear input, no rate limiting (acceptable for this use case).
- GitHub API 401 (bad token): show clear error, prompt to re-enter token.
- GitHub API 404 (repo not found or no access): show clear error.
- Image upload non-image / > 2 MB: reject with inline error.
- Save with no apps: confirm dialog "Delete all apps from the public site?"
- localStorage quota exceeded (base64 icons can be large): catch and tell owner to reduce image size.

## 13. Testing

Manual tests the owner will perform once:

1. Visit `/admin.html`, see login screen, correct password → admin UI.
2. Add a new app with all fields filled, upload an icon, click Save & publish.
3. Wait ~60s, reload public site, verify app shows with icon and store dropdown.
4. Reorder an app, save, verify public order changed.
5. Delete an app, save, verify it's gone.
6. Click Log out, verify login screen reappears.
7. Visit `/admin.html` with wrong password, verify rejection.
8. View source of deployed `admin.html`, verify password literal is present (documented behavior).

No automated tests (no test framework in repo, project is tiny, owner won't run them).

## 14. Open Questions for User

- (none blocking — proceeding once you approve the design above)
