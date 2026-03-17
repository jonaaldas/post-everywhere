# Auto-Generate PR Posts with UI Change Screenshots

## Context

When a PR merges, the app already auto-generates Twitter + LinkedIn text drafts. Goal: if the PR has visual UI changes, also capture screenshots and attach them to posts. Start with screenshots (not video) — simpler, faster, solves the "what to capture" problem via visual diffing.

## Core Idea: Before/After Visual Diff

Instead of guessing what pages changed, **screenshot all pages on both branches and diff them**:

1. Screenshot all pages on `main` (before)
2. Screenshot all pages on PR branch (after)
3. Pixel-diff each pair — pages with differences = "UI changes"
4. Attach the "after" screenshots of changed pages to the posts

This is fully automated — no manual config needed per PR.

## Architecture

**Runs in GitHub Action** (not API server) — Playwright + Chromium too heavy for prod Docker image.

**Storage: Cloudflare R2** — S3-compatible, free egress, stores screenshots.

## Flow

```
PR merged → GitHub Action "screenshot-ui"
  1. Check: any files in apps/web/?
     No  → skip, let normal webhook handle it
     Yes ↓
  2. Checkout main branch → pnpm dev:web → Playwright screenshots all pages → save as "before/"
  3. Checkout PR merge commit → pnpm dev:web → screenshots all pages → save as "after/"
  4. Pixel-diff before/ vs after/ (pixelmatch or similar)
  5. Pages with diff > threshold → upload "after" screenshots to R2
  6. Call webhook with screenshotUrls[] in body
```

## Pages to Screenshot

All protected pages (auto-login via Playwright with test/seed credentials):

| Route | Screenshot Name | Notes |
|-------|----------------|-------|
| `/` | `home.png` | Posts list (needs seed data for meaningful screenshot) |
| `/posts/:id` | `post-detail.png` | Need a seed post ID |
| `/settings` | `settings.png` | GitHub + social connections |
| `/webhook-logs` | `webhook-logs.png` | Webhook table |
| `/login` | `login.png` | Public, no auth needed |

**Auth approach**: Playwright logs in via the `/login` page with seed user credentials (env vars in GH Action secrets).

## Phases

### Phase 1: Schema + API (media support)

- `apps/api/src/db/schema.ts` — add `mediaUrls: text('media_urls')` to `posts` table (JSON array of URLs, nullable)
- `apps/api/src/db/posts/posts.ts` — update `createPost` param type, update `duplicatePost` to copy mediaUrls
- `apps/api/src/routes/webhooks/webhooks.ts` — accept optional `screenshotUrls: string[]` from body, store as `mediaUrls` JSON
- `apps/api/src/test/db-helper.ts` — add column
- Tests for all changes

### Phase 2: GitHub Action + Screenshot Script

**New `.github/workflows/screenshot-ui.yml`**:
- Triggers on `pull_request: [closed]` + merged
- Check for `apps/web/` file changes
- Job: checkout main → install → dev:web → screenshot → checkout merge → dev:web → screenshot → diff → upload to R2

**New `scripts/screenshot-pages.mjs`**:
```js
// Playwright script
// 1. Launch Chromium
// 2. Navigate to /login, fill credentials, submit
// 3. For each page: navigate, wait for idle, screenshot
// 4. Save to output dir (before/ or after/)
```

**New `scripts/diff-screenshots.mjs`**:
```js
// Uses pixelmatch + pngjs
// Compare before/X.png vs after/X.png
// Output list of pages with visual changes
// Threshold: ignore diffs < 0.1% (timestamps, etc.)
```

**New `scripts/upload-screenshots.mjs`**:
```js
// Upload changed "after" screenshots to R2
// Call API webhook with screenshotUrls
```

**Deps (CI only)**: `playwright`, `pixelmatch`, `pngjs`, `@aws-sdk/client-s3`, `wait-on`

### Phase 3: Publishers with media

- `apps/api/src/lib/publisher/types.ts` — extend: `publish(content, accessToken, mediaUrls?)`
- `apps/api/src/lib/publisher/twitter.ts` — if mediaUrls: download images, `client.v1.uploadMedia()` for each, tweet with `media.media_ids` (up to 4 images)
- `apps/api/src/lib/publisher/linkedin.ts` — if mediaUrls: register image upload, upload binary, include `images` in post content
- `apps/api/src/routes/posts/posts.ts` — parse `post.mediaUrls` JSON, pass to publisher
- Tests

### Phase 4: Frontend

- `apps/web/src/pages/posts/[id].vue` — show screenshot previews if `mediaUrls` exists
- `apps/web/src/pages/index.vue` — image icon on cards with media

## New Dependencies

| Dep | Where | Purpose |
|-----|-------|---------|
| `@aws-sdk/client-s3` | scripts/ | R2 upload |
| `playwright` | CI only | Screenshots |
| `pixelmatch` | CI only | Image diff |
| `pngjs` | CI only | PNG read/write |
| `wait-on` | CI only | Wait for dev server |

None added to the production API or web app.

## New Env Vars / GH Secrets

- `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_URL`
- `SEED_USER_EMAIL`, `SEED_USER_PASSWORD` — for Playwright auto-login
- `API_WEBHOOK_SECRET` — if Action calls webhook directly (reuse existing `GITHUB_WEBHOOK_SECRET`)

## Verification

1. Merge PR touching `apps/web/` → Action screenshots before/after, diffs, uploads changed screenshots, posts created with `mediaUrls`
2. Merge PR touching only `apps/api/` → Action skips screenshots, posts created text-only
3. Publish post with screenshots → Twitter/LinkedIn post includes images
4. Publish text-only post → works as before

## Unresolved Questions

1. **Seed data for screenshots** — home page and post detail need posts in the DB to be meaningful. Should we seed test data before screenshotting, or screenshot whatever state the app has? (The app connects to Turso prod DB even in dev mode, so screenshots would show real data — could be fine)
2. **R2 bucket setup** — public or private? Public is simpler. Recommend public since these are social media images anyway.
3. **Diff threshold** — what % pixel difference counts as a "real" UI change vs noise (timestamps, random IDs)? Suggest 0.1% minimum.
4. **Multiple screenshots per page?** — should we screenshot different viewport sizes (mobile + desktop) or just desktop 1280x720?
