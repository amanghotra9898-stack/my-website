# SDX PLAYS — Private Analytics (Phase 1) setup

Everything runs on Cloudflare's free tier: **Pages + Pages Functions + D1 + Cloudflare Access**.
No secrets live in this repository. Values marked *secret* are entered only in the Cloudflare dashboard.

## What was added
| Path | Purpose |
|---|---|
| `functions/api/track.js` | `POST /api/track` — stores page views + download-button clicks (validated, de-duplicated, rate-limited, no cookies, no raw IPs) |
| `functions/api/admin/stats.js` | `GET /api/admin/stats` — aggregated numbers for the dashboard |
| `functions/api/admin/_middleware.js`, `functions/admin/_middleware.js` | Second lock: require a valid Cloudflare Access session for an allowed email, otherwise 403 |
| `functions/_lib/*` | Shared helpers (Access token verification, hashing, security headers) |
| `docs/admin/` | Private dashboard page (`/admin/`) |
| `analytics/schema.sql` | Database table — run once in D1 |
| `docs/assets/js/main.js` | Small tracking hook (skipped on GitHub Pages, honours Do-Not-Track / GPC) |

`functions/` and `analytics/` are outside `docs/`, so GitHub Pages never serves them.

## One-time Cloudflare setup
1. **Pages project**: Workers & Pages → Create → Pages → Connect to Git → repo `my-website`
   - Framework preset: *None* · Build command: *(empty)* · Build output directory: `docs`
   - Production branch: `main` · Preview branches: `analytics-phase1`
2. **D1 database**: Storage & Databases → D1 → Create → name `sdx-analytics`.
   Open it → **Console** → paste the contents of `analytics/schema.sql` → Execute.
3. **Bind D1** to the Pages project: Settings → Bindings → Add → D1 database → Variable name `DB` → `sdx-analytics`
   (add it for **Production** and **Preview**).
4. **Variables** (Settings → Variables and Secrets, Production + Preview):
   - `HASH_SALT` — *secret*, a random value of at least 32 characters (64 hex chars recommended)
   - `ADMIN_EMAILS` — your admin email (comma-separate if ever more than one)
   - `ACCESS_TEAM_DOMAIN` — e.g. `yourteam.cloudflareaccess.com` (from Zero Trust → Settings)
   - `ACCESS_AUD` — the *Application Audience (AUD) Tag* of the Access application (step 5)
   - **Never** set `ACCESS_CERTS_URL` (local testing only).
5. **Cloudflare Access** (Zero Trust, free plan up to 50 users):
   Access → Applications → Add → *Self-hosted* → domains:
   `<project>.pages.dev/admin`, `<project>.pages.dev/api/admin` (and the same for `*.<project>.pages.dev` previews)
   → Policy: **Allow**, Include → *Emails* → your email only → login method: One-time PIN (email) or Google.
   Copy the application's **AUD tag** into `ACCESS_AUD`.
6. Redeploy (Deployments → Retry) so the new variables are picked up.

If any of `ACCESS_TEAM_DOMAIN`, `ACCESS_AUD`, `ADMIN_EMAILS` is missing, `/admin/` and `/api/admin/*` return **403** (fail closed).
If `DB` or `HASH_SALT` is missing, tracking stores nothing.

## What the numbers mean
- **Download clicks** = clicks on Medieval Life download buttons. Not confirmed downloads or installs.
- **Visitors** = unique per day per device (salted hash of IP + browser + date; rotates daily).
  7/30-day/all-time visitor totals are sums of daily visitors.
- **GitHub file requests** = GitHub's own counter for the APK asset (includes bots/retries).
- Times and "today" use India time (Asia/Kolkata).

## Abuse protection
Same-origin only · allow-listed pages/games/buttons · 1 KB body limit · bot user-agents ignored ·
page view counted once per visitor per page per 30 min · button click once per 10 s ·
one-time event id (browser retries ignored) · 120 events/hour per visitor and 300/hour per network address.
