// SDX PLAYS — admin authentication core (Cloudflare Pages Functions).
//
// Design (see sdx-plays/ANALYTICS-SETUP.md):
//  * The browser derives K = scrypt(NFKC(lower(username)) + "\0" + NFKC(password), salt; N=2^17, r=8, p=1, 32 bytes).
//  * The server stores only HMAC-SHA-256(pepper, K) (secret ADMIN_PASSWORD_HASH) and the pepper (secret ADMIN_PEPPER).
//  * Second factor: RFC 6238 TOTP (secret ADMIN_TOTP_SECRET) or a one-time recovery code
//    (secret ADMIN_RECOVERY_HASHES = HMAC(pepper, code) list). Every code is accepted at most once (atomic in D1).
//  * Sessions: 32 random bytes in a __Host- cookie (Secure, HttpOnly, SameSite=Strict). D1 stores only SHA-256(token).
//  * Nothing in this file logs credentials. K, codes and tokens never appear in URLs or error messages.

import { SECURITY_HEADERS } from "./util.js";

export const COOKIE = "__Host-sdx_admin";
export const SCRYPT = { v: 1, N: 131072, r: 8, p: 1, dkLen: 32 }; // 2^17, 128 MiB — computed in the browser
const SESSION_ABS_MS = 8 * 60 * 60 * 1000;      // absolute lifetime
const SESSION_IDLE_MS = 30 * 60 * 1000;         // idle timeout
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_PER_SRC = 5;                    // failed/pending attempts per network per 15 min
const LOGIN_GLOBAL_WINDOW_MS = 60 * 60 * 1000;
const LOGIN_MAX_GLOBAL = 20;                    // failed/pending attempts across all networks per hour
const TOTP_STEP = 30, TOTP_DIGITS = 6;

const enc = new TextEncoder();

/* ---------- encoding helpers ---------- */
export function b64u(bytes) {
  let s = ""; for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
export function unb64u(str) {
  if (typeof str !== "string" || !/^[A-Za-z0-9_-]*$/.test(str)) return null;
  try {
    const b = atob(str.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((str.length + 3) % 4));
    return Uint8Array.from(b, (c) => c.charCodeAt(0));
  } catch { return null; }
}
function base32Decode(s) {
  const A = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  s = String(s || "").toUpperCase().replace(/[\s=-]/g, "");
  if (!s || /[^A-Z2-7]/.test(s)) return null;
  let bits = 0, val = 0; const out = [];
  for (const ch of s) { val = (val << 5) | A.indexOf(ch); bits += 5; if (bits >= 8) { out.push((val >>> (bits - 8)) & 255); bits -= 8; } }
  return new Uint8Array(out);
}
export function timingSafeEqual(a, b) {
  if (!(a instanceof Uint8Array) || !(b instanceof Uint8Array)) return false;
  let diff = a.length ^ b.length;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ (i < b.length ? b[i] : 0);
  return diff === 0;
}
export async function sha256(bytes) {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", typeof bytes === "string" ? enc.encode(bytes) : bytes));
}
async function hmac(alg, keyBytes, msgBytes) {
  const key = await crypto.subtle.importKey("raw", keyBytes, { name: "HMAC", hash: alg }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, msgBytes));
}
export const hmac256 = (k, m) => hmac("SHA-256", k, typeof m === "string" ? enc.encode(m) : m);
export const randomBytes = (n) => crypto.getRandomValues(new Uint8Array(n));

/* ---------- configuration (secrets) ---------- */
// ADMIN_PASSWORD_HASH format:  v1$scrypt$<log2 N>$<r>$<p>$<salt b64u>$<HMAC(pepper,K) b64u>
// Only leading/trailing whitespace and newlines (paste accidents) are removed. Everything inside is still validated strictly.
const secret = (v) => String(v == null ? "" : v).trim();
export const MIN_RECOVERY_CODES = 8;

/** Recovery hashes: comma-separated 32-byte HMACs (base64url). Fails closed (null) if missing, if ANY entry is
 *  malformed or duplicated, or if fewer than MIN_RECOVERY_CODES remain — nothing is silently discarded. */
function parseRecovery(raw) {
  const s = secret(raw);
  if (!s) return null;
  const items = s.split(",").map((x) => x.trim());
  const out = [], seen = new Set();
  for (const item of items) {
    if (!/^[A-Za-z0-9_-]{43}$/.test(item) || seen.has(item)) return null;
    const b = unb64u(item);
    if (!b || b.length !== 32) return null;
    seen.add(item); out.push(b);
  }
  return out.length >= MIN_RECOVERY_CODES ? out : null;
}

export function loadConfig(env) {
  const hashRaw = secret(env.ADMIN_PASSWORD_HASH), totpRaw = secret(env.ADMIN_TOTP_SECRET);
  const parts = hashRaw.split("$");
  const pepperRaw = secret(env.ADMIN_PEPPER);
  const pepper = /^[A-Za-z0-9_-]{43}$/.test(pepperRaw) ? unb64u(pepperRaw) : null;
  const totp = base32Decode(totpRaw);
  const recovery = parseRecovery(env.ADMIN_RECOVERY_HASHES);
  if (!recovery) return null;
  if (parts.length !== 7 || parts[0] !== "v1" || parts[1] !== "scrypt") return null;
  const [logN, r, p] = [Number(parts[2]), Number(parts[3]), Number(parts[4])];
  const salt = unb64u(parts[5]), verifier = unb64u(parts[6]);
  if (logN !== 17 || r !== 8 || p !== 1) return null;                      // never accept weaker parameters
  if (!/^[A-Za-z0-9_-]{22,}$/.test(parts[5]) || !/^[A-Za-z0-9_-]{43}$/.test(parts[6])) return null;
  if (!salt || salt.length < 16 || !verifier || verifier.length !== 32) return null;
  if (!pepper || pepper.length !== 32 || !totp || totp.length < 16) return null;
  return { salt, verifier, pepper, totp, recovery, raw: hashRaw + "|" + totpRaw.toUpperCase().replace(/[\s=-]/g, "") };
}

/** Public scrypt parameters. Identical for every caller; a decoy salt is returned if not configured. */
export async function publicParams(env, host) {
  const cfg = loadConfig(env);
  const salt = cfg ? cfg.salt : (await sha256("sdx-plays-decoy-salt|" + host)).slice(0, 16);
  return { v: SCRYPT.v, N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p, dkLen: SCRYPT.dkLen, salt: b64u(salt) };
}

/** Fingerprint of the current credentials. Changing password or TOTP secret invalidates all sessions. */
async function credFingerprint(cfg) { return b64u((await sha256("cred|" + cfg.raw)).slice(0, 16)); }

/* ---------- request checks ---------- */
export function isHttps(request) { return new URL(request.url).protocol === "https:"; }
export function sameOriginPost(request) {
  const self = new URL(request.url).origin;
  const site = request.headers.get("Sec-Fetch-Site");
  const origin = request.headers.get("Origin");
  if (site && site !== "same-origin") return false;
  if (origin) return origin === self;
  return site === "same-origin";
}
export function clientSrc(request) { return request.headers.get("CF-Connecting-IP") || "0.0.0.0"; }

/* ---------- responses ---------- */
export function authJson(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), { status, headers: { ...SECURITY_HEADERS, "Content-Type": "application/json; charset=utf-8", ...extra } });
}
export const GENERIC_FAIL = { error: "Invalid username, password or code." };
export const RATE_LIMITED = { error: "Too many attempts. Please wait and try again later." };

function cookieHeader(token, maxAgeSec) {
  return `${COOKIE}=${token}; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=${maxAgeSec}`;
}
export const clearCookie = () => `${COOKIE}=; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=0`;
function readCookie(request) {
  const m = (request.headers.get("Cookie") || "").match(new RegExp("(?:^|;\\s*)" + COOKIE.replace(/[-]/g, "\\-") + "=([A-Za-z0-9_-]{43})(?:;|$)"));
  return m ? m[1] : null;
}

/* ---------- rate limiting (atomic, concurrency-safe) ---------- */
/** Reserves one attempt slot BEFORE credentials are checked. Returns the reservation id, or null if over limit. */
export async function reserveAttempt(env, srcHash, now) {
  const res = await env.DB.prepare(
    `INSERT INTO admin_login_attempts (ts, src)
     SELECT ?1, ?2
     WHERE (SELECT COUNT(*) FROM admin_login_attempts WHERE src = ?2 AND ts > ?3) < ?4
       AND (SELECT COUNT(*) FROM admin_login_attempts WHERE ts > ?5) < ?6`
  ).bind(now, srcHash, now - LOGIN_WINDOW_MS, LOGIN_MAX_PER_SRC, now - LOGIN_GLOBAL_WINDOW_MS, LOGIN_MAX_GLOBAL).run();
  return res.meta && res.meta.changes === 1 ? res.meta.last_row_id : null;
}
export async function releaseAttempt(env, id) {
  if (id != null) await env.DB.prepare("DELETE FROM admin_login_attempts WHERE id = ?1").bind(id).run();
}

/* ---------- first factor: browser-derived scrypt key ---------- */
export async function verifyDerivedKey(cfg, kB64) {
  const k = unb64u(kB64);
  const ok = k && k.length === 32;
  // Always compute an HMAC, even for malformed input, so timing does not reveal why it failed.
  const mac = await hmac256(cfg ? cfg.pepper : new Uint8Array(32), ok ? k : new Uint8Array(32));
  if (k) k.fill(0);
  return !!(cfg && ok && timingSafeEqual(mac, cfg.verifier));
}

/* ---------- second factor: TOTP (RFC 6238, HMAC-SHA-1, 6 digits, 30 s) ---------- */
async function totpAt(secret, step) {
  const msg = new Uint8Array(8); let s = step;
  for (let i = 7; i >= 0; i--) { msg[i] = s & 255; s = Math.floor(s / 256); }
  const h = await hmac("SHA-1", secret, msg);
  const off = h[h.length - 1] & 15;
  const bin = ((h[off] & 127) << 24) | (h[off + 1] << 16) | (h[off + 2] << 8) | h[off + 3];
  return String(bin % 10 ** TOTP_DIGITS).padStart(TOTP_DIGITS, "0");
}
/** Returns the matching time step (current ±1) or null. Compares all candidates in constant time. */
export async function matchTotp(cfg, code, now) {
  if (!cfg || !/^\d{6}$/.test(code || "")) { if (cfg) await totpAt(cfg.totp, 0); return null; }
  const t = Math.floor(now / 1000 / TOTP_STEP); let match = null;
  for (const step of [t - 1, t, t + 1]) {
    const exp = await totpAt(cfg.totp, step);
    if (timingSafeEqual(enc.encode(exp), enc.encode(code)) && match === null) match = step;
  }
  return match;
}
/** Atomically consumes a TOTP step: succeeds only if no equal-or-later step was ever accepted. */
export async function consumeTotp(env, step, now) {
  const res = await env.DB.prepare(
    `INSERT INTO admin_totp_used (step, used_at)
     SELECT ?1, ?2 WHERE NOT EXISTS (SELECT 1 FROM admin_totp_used WHERE step >= ?1)`
  ).bind(step, now).run();
  return !!(res.meta && res.meta.changes === 1);
}

/* ---------- second factor alternative: one-time recovery codes ---------- */
export function normalizeRecovery(code) { return String(code || "").toUpperCase().replace(/[^A-Z0-9]/g, ""); }
/** Returns the hash of a valid, unused-format recovery code (b64u), or null. */
export async function matchRecovery(cfg, code) {
  const norm = normalizeRecovery(code);
  const h = await hmac256(cfg ? cfg.pepper : new Uint8Array(32), "recovery|" + norm);
  if (!cfg || !/^[A-Z2-7]{16}$/.test(norm)) return null;
  let found = false;
  for (const known of cfg.recovery) if (timingSafeEqual(h, known)) found = true;
  return found ? b64u(h) : null;
}
/** Atomically marks a recovery code as used. Succeeds once per code, ever. */
export async function consumeRecovery(env, codeHash, now) {
  const res = await env.DB.prepare(
    "INSERT INTO admin_recovery_used (code_hash, used_at) VALUES (?1, ?2) ON CONFLICT(code_hash) DO NOTHING"
  ).bind(codeHash, now).run();
  return !!(res.meta && res.meta.changes === 1);
}

/* ---------- sessions ---------- */
export async function createSession(env, cfg, request, now) {
  const token = b64u(randomBytes(32));                              // 43 chars
  const tokenHash = b64u(await sha256("session|" + token));
  const ua = b64u((await sha256("ua|" + (request.headers.get("User-Agent") || ""))).slice(0, 16));
  await env.DB.prepare(
    "INSERT INTO admin_sessions (token_hash, created_at, last_seen, expires_at, cred_fp, ua_hash) VALUES (?1, ?2, ?2, ?3, ?4, ?5)"
  ).bind(tokenHash, now, now + SESSION_ABS_MS, await credFingerprint(cfg), ua).run();
  // housekeeping (never touches analytics events)
  await env.DB.batch([
    env.DB.prepare("DELETE FROM admin_sessions WHERE expires_at < ?1 OR last_seen < ?2").bind(now, now - SESSION_IDLE_MS),
    env.DB.prepare("DELETE FROM admin_login_attempts WHERE ts < ?1").bind(now - 24 * 3600 * 1000),
    env.DB.prepare("DELETE FROM admin_totp_used WHERE used_at < ?1 AND step < (SELECT MAX(step) FROM admin_totp_used)").bind(now - 24 * 3600 * 1000),
  ]);
  return { token, cookie: cookieHeader(token, Math.floor(SESSION_ABS_MS / 1000)) };
}

/** Validates the session cookie. Returns { tokenHash, token } or null. Expired/revoked/foreign sessions are rejected. */
export async function getSession(request, env) {
  const cfg = loadConfig(env);
  if (!cfg || !env.DB) return null;
  const token = readCookie(request);
  if (!token) return null;
  const tokenHash = b64u(await sha256("session|" + token));
  const row = await env.DB.prepare(
    "SELECT created_at, last_seen, expires_at, cred_fp, ua_hash FROM admin_sessions WHERE token_hash = ?1"
  ).bind(tokenHash).first();
  if (!row) return null;
  const now = Date.now();
  const ua = b64u((await sha256("ua|" + (request.headers.get("User-Agent") || ""))).slice(0, 16));
  const valid = row.expires_at > now && now - row.last_seen < SESSION_IDLE_MS
    && row.cred_fp === await credFingerprint(cfg)
    && row.ua_hash === ua; // supplementary signal only; real security is the random token + server-side checks
  if (!valid) {
    await env.DB.prepare("DELETE FROM admin_sessions WHERE token_hash = ?1").bind(tokenHash).run();
    return null;
  }
  if (now - row.last_seen > 60 * 1000) {
    await env.DB.prepare("UPDATE admin_sessions SET last_seen = ?1 WHERE token_hash = ?2").bind(now, tokenHash).run();
  }
  return { tokenHash, token, cfg };
}

/** Per-session CSRF token, derived from the session token with the pepper (nothing extra stored). */
export async function csrfFor(session) { return b64u(await hmac256(session.cfg.pepper, "csrf|" + session.token)); }
export async function checkCsrf(request, session) {
  const sent = unb64u(request.headers.get("X-CSRF-Token") || "");
  const exp = unb64u(await csrfFor(session));
  return !!(sent && exp && timingSafeEqual(sent, exp));
}

export async function revokeSession(env, tokenHash) {
  await env.DB.prepare("DELETE FROM admin_sessions WHERE token_hash = ?1").bind(tokenHash).run();
}
export async function revokeAllSessions(env) { await env.DB.prepare("DELETE FROM admin_sessions").run(); }

/* ---------- shared guards ---------- */
// Admin pages get the site CSP plus Trusted Types (only the login page's Worker URL policy exists).
export const ADMIN_HEADERS = {
  ...SECURITY_HEADERS,
  "Content-Security-Policy": SECURITY_HEADERS["Content-Security-Policy"] + "; worker-src 'self'; require-trusted-types-for 'script'; trusted-types sdx-admin",
  "Strict-Transport-Security": "max-age=31536000",
};
export function httpsRequired() { return authJson({ error: "HTTPS required." }, 403); }

/** Network identifier for rate limiting (keyed hash — raw IPs are never stored). */
export async function srcHash(env, request) {
  const key = env.HASH_SALT ? enc.encode(String(env.HASH_SALT)) : new Uint8Array(32);
  return b64u((await hmac256(key, "admin-login|" + clientSrc(request))).slice(0, 16));
}

export async function recoveryRemaining(env, cfg) {
  const { results } = await env.DB.prepare("SELECT code_hash FROM admin_recovery_used").all();
  const used = new Set((results || []).map((r) => r.code_hash));
  return cfg.recovery.filter((h) => !used.has(b64u(h))).length;
}
