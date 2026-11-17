# SDX PLAYS — Official Website

Static website: HTML + CSS + vanilla JavaScript. No backend, no database, no login, no paid services.

## Project layout
```
README.md             This file (NOT deployed)
SECURITY.md           Security audit + Cloudflare/GitHub hardening steps (NOT deployed)
.gitignore
public/               ← everything inside here is the live website (Cloudflare output directory)
  index.html          Home: studio intro, featured game (Medieval Life), features, socials
  games.html          Games catalog (rendered from site-data.js; first game = featured, top)
  medieval-life.html  Medieval Life details page
  about.html, contact.html, 404.html
  _headers            Security + cache headers (Cloudflare Pages reads this automatically)
  sitemap.xml, robots.txt, site.webmanifest, favicon.ico
  assets/css/style.css
  assets/js/site-data.js   ← EDIT THIS: games, download links, socials, emails
  assets/js/main.js        Site behaviour (menu, search, slider, gallery, downloads)
  assets/img/              Logo, icons, OG image, hero art
```
Only `public/` is published, so README/SECURITY notes are never served to visitors.

## Filling in placeholders
Empty strings (`""`) in `public/assets/js/site-data.js` are placeholders. Download buttons stay **hidden**
until a real `https://` download URL is filled in; other missing details show "To be announced".

| What | Where |
|---|---|
| Android download (Play Store or APK URL) | `site-data.js` → `games[0].downloads.android` — the big DOWNLOAD GAME button appears automatically |
| APK version + file size (real values) | `site-data.js` → `games[0].apk.version`, `games[0].apk.size` |
| Web / Playgama link | `site-data.js` → `games[0].downloads.web` |
| More screenshots | add 1600×900 + 640×360 webp files to `public/assets/img/games/medieval-life/` and list them in `screenshots: [...]` |
| Emails | `site-data.js` → `site.email`, `site.businessEmail` |
| Social links | `site-data.js` → `social.youtube / instagram / discord / telegram` |
| Version, size, release date, requirements, full description | `medieval-life.html` (search "To be announced") |
| Custom domain (later) | replace `https://sdx-plays.pages.dev` in all `.html`, `sitemap.xml`, `robots.txt`, `_headers` |

URL rules (enforced in code): external links must be `https://`; local files must be plain relative paths
like `downloads/medieval-life.apk`. `javascript:`, `data:`, `http:`, `//…`, `../` and `user:pass@` URLs are ignored.
Cloudflare Pages has a 25 MB per-file limit — never put the APK inside `public/` or the repo.

### Hosting the APK on GitHub Releases (free)
1. Build the final signed APK in Godot (Project → Export → Android → Export Project, **release**).
2. GitHub → your website repo → **Releases → Draft a new release** → tag e.g. `medieval-life-v0.9.3`.
3. Drag `MedievalLife.apk` into "Attach binaries" → **Publish release**.
4. Right-click the APK under *Assets* → copy link. It looks like
   `https://github.com/<user>/<repo>/releases/download/<tag>/MedievalLife.apk`.
5. Paste it into `downloads.android`, fill `apk.version` + `apk.size`, commit — the button goes live.
(Tip: also put the APK's SHA-256 in the release notes so players can verify the file.)

**If you ever add an image or font from another website**, you must also allow that domain in the
`Content-Security-Policy` line of `public/_headers`, otherwise the browser will block it.

## Adding a game later
1. Add an entry to `games` in `site-data.js` (appears automatically on Home, Games and Search).
2. Copy `medieval-life.html` to `<game>.html` and edit it.
3. Add the page to `sitemap.xml`.

## Local preview
```
cd public
python -m http.server 8000
```
Open http://localhost:8000 (the `_headers` file is only applied by Cloudflare, not by this preview server).

## Deploy to Cloudflare Pages (free) — when you're ready
1. Create a **new GitHub repository** (e.g. `sdx-plays-website`) and upload this folder's contents
   (`public/`, `README.md`, `SECURITY.md`, `.gitignore`). Website files only — no game projects.
2. Cloudflare dashboard → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**.
3. Authorise the Cloudflare GitHub app for **only this repository** → select it.
4. Build settings: Framework preset **None** · Build command **(leave empty)** · Build output directory **`public`**.
5. Project name **`sdx-plays`** (this gives `https://sdx-plays.pages.dev`; if the name is taken, use another and
   update the URLs listed above) → **Save and Deploy**.
6. After deploy, verify headers: open https://securityheaders.com and test `https://sdx-plays.pages.dev`,
   or run `curl -I https://sdx-plays.pages.dev`.
7. Submit `https://sdx-plays.pages.dev/sitemap.xml` in Google Search Console (free). Indexing is not guaranteed and rankings can't be promised.

Alternative without GitHub: Workers & Pages → Create → Pages → **Upload assets** → drag in the **contents of `public/`**.
