# SDX PLAYS Website — Security Audit & Hardening Guide
Audit date: 2026-11-17 · Scope: everything in `public/` · Architecture: static HTML/CSS/JS, no backend.

No website can be made 100% unhackable. For a static site like this one, the main real-world risks are:
(1) someone gets into your **GitHub or Cloudflare account** and changes the site (defacement),
(2) **malicious script injection** through the page code, and (3) the site being **framed or impersonated**.
The code fixes below handle (2) and (3). Only **you** can handle (1), by securing your accounts (Part C).

The public site has no user accounts. The only login is the private analytics admin (`/admin/`, custom sign-in with password + authenticator code — see `ANALYTICS-SETUP.md`); the analytics database stores no names, emails or raw IP addresses.
No fake security features were added.

## Part A — Audit results

| # | Check | Result | Notes |
|---|---|---|---|
| A1 | `eval`, `new Function`, `document.write` | **PASS** | None present. |
| A2 | `innerHTML` / HTML-string rendering of data | **PASS** (fixed) | Previously built HTML strings (escaped). Now every element is built with `createElement` + `textContent`/`setAttribute`. Icons are fixed SVG constants parsed with `DOMParser`. |
| A3 | XSS through `site-data.js` values | **PASS** (fixed) | Tested with malicious titles, tags, descriptions, emails: shown as plain text, no script ran. |
| A4 | URL validation (`javascript:`, `data:`, `http:`, `//host`, `../`, `user:pass@`) | **PASS** (fixed) | Game `page`/`cover`/screenshot paths were not validated before; now all URLs pass through `safeHttps()` / `safePath()`. Verified by test. |
| A5 | External links use `rel="noopener noreferrer"` + new tab | **PASS** | Applied automatically to every external link. |
| A6 | Credentials / API keys / tokens in frontend | **PASS** | None found (scanned all HTML/JS/headers). The site needs none. |
| A7 | Third-party scripts | **PASS** | Zero. Only third-party resource is Google Fonts (CSS + font files). |
| A8 | Content-Security-Policy | **PASS** (strengthened) | `default-src 'none'`; scripts only from this site; **no `'unsafe-inline'`** (all inline styles/handlers removed); Google Fonts explicitly allowed. Tested in a browser with the CSP active: 0 violations. |
| A9 | Clickjacking | **PASS** | `frame-ancestors 'none'` + `X-Frame-Options: DENY`. Tested: page refuses to load in an iframe. |
| A10 | X-Content-Type-Options, Referrer-Policy, Permissions-Policy, COOP, CORP | **PASS** | Set in `_headers`. |
| A11 | HSTS | **PASS** | `max-age=31536000` (1 year). Safe because `*.pages.dev` is always HTTPS. No `includeSubDomains`/`preload` — only add those for your own custom domain once every subdomain is HTTPS. |
| A12 | Sensitive file exposure | **PASS** (fixed) | Website moved into `public/`; README/SECURITY notes and anything else in the repo root are no longer served. `.gitignore` blocks `.env`, keys, keystores, APKs. Cloudflare Pages has no directory listing. |
| A13 | Preview deployments indexed by Google | **PASS** | `X-Robots-Tag: noindex` on `*.sdx-plays.pages.dev` preview URLs. |
| A14 | Header file applied on the live site | **NEEDS ATTENTION** | `_headers` follows Cloudflare's format and was tested on a local server that applies it. It must be re-checked **after deploying** (see README step 6). |
| A15 | Google Fonts loading under CSP | **NEEDS ATTENTION** | Allowed in CSP, but the test sandbox had no internet so the real font download couldn't be confirmed. Check fonts look right after deploy. (Optional: self-host the fonts to remove the last third party.) |
| A16 | Account security (GitHub/Cloudflare 2FA etc.) | **NEEDS ATTENTION** | Can't be done in code — see Part C. This is the most important item. |
| A17 | Cloudflare zone protections (WAF, Bot Fight Mode, SSL mode) | **NEEDS ATTENTION** | Only apply once you connect a custom domain — see Part B. |

## Part B — Cloudflare settings (free plan), done by you in the dashboard

**While you only use `sdx-plays.pages.dev`:**
- HTTPS/SSL is automatic and can't be turned off. Nothing to configure.
- Cloudflare's automatic network-level DDoS protection is always on.
- WAF, Bot Fight Mode, SSL mode etc. are **zone** settings: they need a domain added to Cloudflare. They do **not** apply to a `pages.dev` address, so don't look for them yet.
- Workers & Pages → your project → **Settings**:
  - *Builds & deployments → Preview deployments*: set to **None** (or only specific branches) if you don't want every branch to get a public preview URL.

**Later, if you connect your own domain** (add the domain to Cloudflare, then Pages project → Custom domains), open that domain in the dashboard:
1. **SSL/TLS → Overview**: encryption mode **Full (strict)**.
2. **SSL/TLS → Edge Certificates**: **Always Use HTTPS = On**, **Automatic HTTPS Rewrites = On**, **Minimum TLS Version = 1.2**, **TLS 1.3 = On**. HSTS: enable only after everything works over HTTPS (start with a short max-age).
3. **Security → WAF**: the **Cloudflare Free Managed Ruleset** is on by default on free plans; keep it enabled. Optionally add a custom rule (free plan includes a few), e.g. block requests to paths like `/wp-admin`, `/.env`, `/.git` (this site has none, so this just cuts bot noise).
4. **Security → Bots**: **Bot Fight Mode = On**. If a legit service (e.g. a link-preview bot) gets blocked, turn it off.
5. **Security → Settings**: Security Level **Medium**, **Browser Integrity Check = On**. **Under Attack Mode**: only turn on during an active attack, then turn it off again.
6. **Security → DDoS**: the HTTP DDoS managed ruleset is on automatically. Leave the defaults.
7. **DNS**: turn on **DNSSEC** (DNS → Settings). Keep the website records **Proxied** (orange cloud).

Dashboard menu names change from time to time. If a name doesn't match, use the dashboard search.

## Part C — Account security (most important), done by you

**GitHub**
1. Turn on two-factor authentication: profile picture → **Settings → Password and authentication → Enable two-factor authentication**. Use an authenticator app (or a passkey/security key), not SMS. **Save the recovery codes** somewhere offline.
2. Use a strong, unique password.
3. Repository → **Settings → Branches/Rules → add a ruleset for `main`**: block force pushes and block deletion. If you ever have collaborators, also require pull requests.
4. Repository → **Settings → Code security**: enable **Secret scanning** and **Push protection** (blocks commits that contain keys/tokens). Free for public repositories.
5. **Settings → Applications → Installed GitHub Apps → Cloudflare**: give it access to **only** the website repository.
6. Only add collaborators you trust, with the lowest role they need. Review **Settings → Sessions / SSH keys / Personal access tokens** now and then and remove anything you don't recognise.
7. Never commit passwords, API keys, Android keystores (`.jks`/`.keystore`) or signing passwords. `.gitignore` already blocks common secret files. If something leaks: revoke or rotate it **first**, then remove it from the repo. Deleting the file alone isn't enough, because it stays in the git history.

**Cloudflare**
1. **My Profile → Authentication → Two-Factor Authentication**: enable with an authenticator app or security key. Save the backup codes offline.
2. Strong, unique password. Don't share the account: use **Manage Account → Members** with limited roles if someone needs access.
3. Don't create API tokens unless you need them. If you do, give them the narrowest permission and an expiry date, and never put them in the website files.
4. Turn on login/security notification emails.

**Email:** enable 2FA on the email account that owns GitHub and Cloudflare too. Whoever controls that inbox can reset both.

## Part D — Ongoing
- After every change: check the site, check that `_headers` still applies, and check for console errors.
- Re-run the header check (securityheaders.com) after any `_headers` edit.
- If you ever add a contact form, comments or a login, that needs a new security review. This audit covers a static site only.
