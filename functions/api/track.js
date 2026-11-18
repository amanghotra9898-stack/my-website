// POST /api/track — records a page view or a download-button click.
// Public endpoint, but it only accepts small, well-formed events from this site,
// stores no raw IP and no cookies, and quietly drops spam / repeats.

import { istDay, empty, hmacHex, deviceFromUA, BOT_UA, SECURITY_HEADERS } from "../_lib/util.js";

const PATHS = new Set(["/", "/games", "/medieval-life", "/about", "/contact", "/404"]);
const GAMES = new Set(["medieval-life"]);
const BUTTONS = new Set(["hero", "screenshots", "card-home", "card-games", "titlebar", "sidebar", "other"]);

const MAX_BODY = 1024;               // bytes
const MAX_EVENTS_PER_HOUR = 120;     // per daily visitor hash (IP + browser)
const MAX_EVENTS_PER_IP_HOUR = 300;  // per network address (stops browser-identity rotation)
const PAGEVIEW_DEDUPE_MS = 30 * 60 * 1000;
const CLICK_DEDUPE_MS = 10 * 1000;

function normPath(p) {
  if (typeof p !== "string" || p.length > 100) return null;
  p = p.split(/[?#]/)[0].replace(/\/index(\.html)?$/, "/").replace(/\.html$/, "");
  if (p.length > 1) p = p.replace(/\/+$/, "");
  return PATHS.has(p) ? p : null;
}

function sameOrigin(request) {
  const self = new URL(request.url).origin;
  const site = request.headers.get("Sec-Fetch-Site");
  if (site && site !== "same-origin") return false;
  const origin = request.headers.get("Origin");
  return origin ? origin === self : site === "same-origin";
}

export async function onRequestPost({ request, env }) {
  // 1. Basic request hygiene
  if (!sameOrigin(request)) return empty(403);
  const len = Number(request.headers.get("Content-Length") || 0);
  if (len > MAX_BODY) return empty(413);
  const ua = request.headers.get("User-Agent") || "";
  if (!ua || BOT_UA.test(ua)) return empty();               // ignore bots silently
  if (!env.DB || !env.HASH_SALT || env.HASH_SALT.length < 32) return empty(503); // not configured → store nothing

  let body;
  try {
    const text = await request.text();
    if (text.length > MAX_BODY) return empty(413);
    body = JSON.parse(text);
  } catch { return empty(400); }
  if (!body || typeof body !== "object") return empty(400);

  // 2. Validate against allow-lists
  const type = body.t === "pv" ? "pageview" : body.t === "dl" ? "download_click" : null;
  const path = normPath(body.p);
  if (!type || !path) return empty(400);
  let game = null, button = null;
  if (type === "download_click") {
    if (!GAMES.has(body.g)) return empty(400);
    game = body.g;
    button = BUTTONS.has(body.b) ? body.b : "other";
  }
  let referrer = null;
  if (type === "pageview" && typeof body.r === "string" && body.r.length < 300) {
    try {
      const h = new URL(body.r).hostname.toLowerCase();
      if (h && h !== new URL(request.url).hostname) referrer = h.slice(0, 100);
    } catch { /* ignore bad referrer */ }
  }

  // One-time event id from the browser: a re-sent copy of the same event is ignored.
  const eid = typeof body.i === "string" && /^[a-f0-9]{24}$/.test(body.i) ? body.i : null;
  if (!eid) return empty(400);

  // 3. Daily-rotating anonymous visitor id (no raw IP stored)
  const now = Date.now();
  const day = istDay(now);
  const ip = request.headers.get("CF-Connecting-IP") || "0.0.0.0";
  const visitor = (await hmacHex(env.HASH_SALT, `${ip}|${ua}|${day}`)).slice(0, 32);
  const src = (await hmacHex(env.HASH_SALT, `ip|${ip}|${day}`)).slice(0, 32);

  // 4. Rate limit + de-duplication
  const db = env.DB;
  const recent = await db.prepare(
    "SELECT COUNT(*) AS ip, SUM(CASE WHEN visitor = ?1 THEN 1 ELSE 0 END) AS v FROM events WHERE src = ?2 AND ts > ?3"
  ).bind(visitor, src, now - 3600000).first();
  if (recent && (recent.v >= MAX_EVENTS_PER_HOUR || recent.ip >= MAX_EVENTS_PER_IP_HOUR)) return empty(429);

  const dup = type === "pageview"
    ? await db.prepare("SELECT 1 FROM events WHERE visitor = ?1 AND type = 'pageview' AND path = ?2 AND ts > ?3 LIMIT 1")
        .bind(visitor, path, now - PAGEVIEW_DEDUPE_MS).first()
    : await db.prepare("SELECT 1 FROM events WHERE visitor = ?1 AND type = 'download_click' AND button = ?2 AND ts > ?3 LIMIT 1")
        .bind(visitor, button, now - CLICK_DEDUPE_MS).first();
  if (dup) return empty();

  // 5. Store
  const cf = request.cf || {};
  await db.prepare(
    "INSERT OR IGNORE INTO events (eid, ts, day, type, path, game, button, visitor, src, device, country, referrer) VALUES (?12,?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11)"
  ).bind(now, day, type, path, game, button, visitor, src, deviceFromUA(ua),
         typeof cf.country === "string" ? cf.country.slice(0, 2) : null, referrer, eid).run();

  return empty();
}

export function onRequest() {
  return new Response("Method Not Allowed", { status: 405, headers: { ...SECURITY_HEADERS, Allow: "POST" } });
}
