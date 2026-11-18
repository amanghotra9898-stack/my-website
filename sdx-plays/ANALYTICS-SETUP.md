# SDX PLAYS — Private Analytics (Phase 1) setup

Everything runs on Cloudflare's free tier: **Pages + Pages Functions + D1**. No card or paid plan needed.
No secrets live in this repository. Values marked *secret* are created only on your own PC (with the offline tool)
and entered only in the Cloudflare dashboard, environment **Preview** only, until you approve Production.

## What was added
| Path | Purpose |
|---|---|
| `functions/api/track.js` | `POST /api/track` — stores page views + download-button clicks (validated, de-duplicated, rate-limited, no cookies, no raw IPs) |
| `functions/api/admin/stats.js` | `GET /api/admin/stats` — aggregated numbers for the dashboard |
| `functions/api/auth/*.js` | Admin sign-in: `params` (GET), `login`, `logout`, `logout-all` (POST), `session` (GET) |
| `functions/admin/_middleware.js`, `functions/api/admin/_middleware.js` | Require a valid admin session for `/admin/*` and `/api/admin/*` |
| `functions/_lib/auth.js`, `functions/_lib/util.js` | Login, TOTP, recovery codes, sessions, CSRF, rate limits, security headers |
| `docs/admin/login.html`, `login.js`, `scrypt-worker.js` | Sign-in page; the password is turned into a key in the browser |
| `docs/admin/vendor/noble-hashes/` | Audited open-source scrypt (MIT) — see `VENDOR.md` there |
| `docs/admin/` (index, admin.js, admin.css) | Private dashboard (`/admin/`) |
| `analytics/schema.sql`, `analytics/schema-auth.sql` | D1 tables — run each once |
| `sdx-plays/tools/make-admin-credentials.html` | **Offline** tool that creates the admin secrets on your PC |
| `docs/assets/js/main.js` | Small tracking hook (skipped on GitHub Pages, honours Do-Not-Track / GPC) |

`functions/`, `analytics/` and `sdx-plays/` are outside `docs/`, so GitHub Pages never serves them.

## How the admin login works (short)
1. You type username + password + the 6-digit code from your authenticator app at `/admin/login`.
2. Your browser runs **scrypt** (N=2^17, r=8, p=1, 128 MiB, about 1–3 s) on `username + password` with a public salt.
   The password itself never leaves the browser. The 32-byte result **K** is sent once, in the body of an HTTPS POST.
3. The server computes `HMAC-SHA-256(ADMIN_PEPPER, K)` and compares it (constant time) with `ADMIN_PASSWORD_HASH`.
4. The 6-digit code (RFC 6238 TOTP) — or a one-time recovery code — must also be correct. **Each code works only once**,
   even if two requests arrive at the same moment (atomic check in D1).
5. On success the server sets a random session cookie `__Host-sdx_admin` (Secure, HttpOnly, SameSite=Strict).
   D1 stores only a hash of it. Sessions end after **30 min idle** (checked once a minute, so up to ~31 min)
   or **8 h** in total, on Sign out, on *Sign out everywhere*, and automatically when the password or
   authenticator secret is changed.
6. Each session is also tied to your browser's identity string (User-Agent). If it changes — for example after a
   browser update, switching on "desktop site" on a phone, or a different browser — that session ends and you simply
   sign in again. This is only an extra signal, not a security boundary.

**Honest limits.** K is password-equivalent: someone who captured K could replay it — but they would still need a fresh
6-digit code (or an unused recovery code), and K is only ever sent over HTTPS, never logged, never stored in the browser,
never in a URL. The pepper protects a leaked hash/database; it does not protect a stolen K. The
User-Agent check on sessions is only an extra signal, not real protection. No website can be made 100% unhackable;
keep your PC, phone and Cloudflare account secure.

## One-time Cloudflare setup (Preview only)
1. **Pages project** (already done): output directory `docs`, Preview branch `analytics-phase1`.
2. **D1 database** `sdx-analytics` (already done) → **Console**:
   - `analytics/schema.sql` (already done)
   - paste `analytics/schema-auth.sql` → Execute. It only creates the four `admin_*` tables; it never touches `events`.
3. **Binding** `DB` → `sdx-analytics` for **Preview** (already done).
4. **Create the admin secrets on your PC** — see the next section.
5. **Variables and Secrets → Preview** (type **Secret** for each):
   `HASH_SALT` (already set), `ADMIN_PASSWORD_HASH`, `ADMIN_PEPPER`, `ADMIN_TOTP_SECRET`, `ADMIN_RECOVERY_HASHES`.
6. Redeploy the Preview (Deployments → Retry) so the new secrets are picked up.

If any of the four admin secrets is missing or malformed, **nobody can sign in** (fail closed) — the server never
falls back to a default password. This includes `ADMIN_RECOVERY_HASHES`: it must hold **at least 8** valid, distinct
entries, and a single damaged entry blocks sign-in (it is never silently skipped). Accidental spaces or line breaks at
the very start or end of a pasted secret are ignored; anything wrong inside a value still blocks sign-in.
If `DB` or `HASH_SALT` is missing, tracking stores nothing.

## Creating the admin secrets (TOTP setup)
1. On your PC open `sdx-plays/tools/make-admin-credentials.html` by double-clicking it (opens in your browser, works
   offline; it is blocked from making any network request).
2. Choose **First-time setup**. Enter a username. Click **Generate strong password** — the tool creates
   24 random characters with your browser's secure random generator — and save that password in your password
   manager straight away (it is not shown again). A password you type yourself must be **at least 20 characters**;
   anything shorter is refused. Then click **Generate**.
3. **Authenticator:** in Google Authenticator / Microsoft Authenticator / Aegis / 2FAS choose *Add account → Enter a
   setup key*, name it `SDX PLAYS admin`, type *Time-based*, and type the key shown. Make sure the phone's time is set
   automatically. Type the 6-digit code the app shows and click **Verify code**.
4. The four secrets appear. Copy each into Cloudflare (step 5 above). Do **not** paste them into chat, email, GitHub or code.
5. **Recovery codes:** 10 codes are shown **once** (the server requires at least 8 configured). Save them in your password manager or write them on paper kept
   somewhere safe. Each can replace the 6-digit code one time. Store `ADMIN_PEPPER` in your password manager too —
   you need it to change your password later.
6. Close the tab. The tool saves nothing.

## Everyday sign-in
`https://<preview-address>/admin/` → redirected to the sign-in page → username, password, 6-digit code → dashboard.
Use **Sign out** when done. **Sign out everywhere** (bottom of the dashboard) ends every admin session on every device.

## Lost phone — recovery
1. On the sign-in page click **Use a recovery code instead** and enter one of your recovery codes.
2. Each code works once. After signing in, the dashboard shows a separate red warning when fewer than 3 unused codes
   are left. Create a fresh set before you run out (see step 4).
3. Set up a new authenticator: run the tool in **First-time setup** mode and replace all four secrets in Cloudflare.
   This also ends all existing sessions and invalidates the old authenticator and old recovery codes.
4. For new recovery codes only: tool → **New recovery codes only** (needs `ADMIN_PEPPER`) → replace `ADMIN_RECOVERY_HASHES`.

## Changing the password
Tool → **Change password only** → paste `ADMIN_PEPPER`, enter username + new password (generate one, or type at least
20 characters) → replace `ADMIN_PASSWORD_HASH`
in Cloudflare (Preview) → redeploy. A new salt is created, the old password stops working and **every existing session
is signed out**. Your authenticator and recovery codes keep working.

## Lockout
- **Too many attempts:** 5 failed attempts per network in 15 minutes, or 20 failed attempts in total per hour
  (all networks together), block new attempts — even correct ones — until the window passes. Just wait
  (at most 15 min / 1 hour). Successful sign-ins don't count.
- **Emergency unlock** (only if you are sure the failures were yours): D1 → Console →
  `DELETE FROM admin_login_attempts;`
- **Lost phone *and* all recovery codes, or forgot the password:** run the tool in **First-time setup** mode and
  replace all four secrets in Cloudflare. Your Cloudflare account is the root of trust — protect it with its own 2FA.
- **Suspect someone else signed in:** click *Sign out everywhere*, then change the password (or do a full new setup).

## What the numbers mean
- **Download clicks** = clicks on Medieval Life download buttons. Not confirmed downloads or installs.
- **Visitors** = unique per day per device (salted hash of IP + browser + date; rotates daily).
  7/30-day/all-time visitor totals are sums of daily visitors.
- **GitHub file requests** = GitHub's own counter for the APK asset (includes bots/retries).
- Times and "today" use India time (Asia/Kolkata).

## Abuse protection
Tracking: same-origin only · allow-listed pages/games/buttons · 1 KB body limit · bot user-agents ignored ·
page view counted once per visitor per page per 30 min · button click once per 10 s ·
one-time event id (browser retries ignored) · 120 events/hour per visitor and 300/hour per network address.

Admin: HTTPS only · same-origin + per-session CSRF token on every state change · identical error for every wrong
username/password/code · concurrency-safe rate limits · Trusted Types + strict CSP on admin pages · no-store, noindex.
