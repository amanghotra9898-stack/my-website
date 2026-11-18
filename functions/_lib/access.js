// Cloudflare Access verification (defence in depth).
// Cloudflare Access already blocks everyone except the allowed email at the edge.
// This second check makes the admin area FAIL CLOSED if Access is ever switched off
// or misconfigured: no valid signed Access token for an allowed email → 403.
//
// Required environment variables (Pages project → Settings → Variables and Secrets):
//   ACCESS_TEAM_DOMAIN  e.g. "yourteam.cloudflareaccess.com"
//   ACCESS_AUD          the Application Audience (AUD) tag of the Access application
//   ADMIN_EMAILS        comma-separated list of allowed emails (just yours)

let jwksCache = { url: "", keys: null, at: 0 };

function b64urlToBytes(s) {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  const pad = s.length % 4 ? "=".repeat(4 - (s.length % 4)) : "";
  const bin = atob(s + pad);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}
function b64urlJson(s) {
  return JSON.parse(new TextDecoder().decode(b64urlToBytes(s)));
}

async function getKeys(certsUrl) {
  const fresh = Date.now() - jwksCache.at < 10 * 60 * 1000;
  if (jwksCache.keys && jwksCache.url === certsUrl && fresh) return jwksCache.keys;
  const res = await fetch(certsUrl, { cf: { cacheTtl: 600 } });
  if (!res.ok) throw new Error("certs fetch failed");
  const { keys } = await res.json();
  jwksCache = { url: certsUrl, keys: Array.isArray(keys) ? keys : [], at: Date.now() };
  return jwksCache.keys;
}

/**
 * Returns { ok: true, email } for a valid Access session of an allowed admin,
 * otherwise { ok: false, reason }.
 */
export async function verifyAccess(request, env) {
  const team = (env.ACCESS_TEAM_DOMAIN || "").trim().replace(/^https?:\/\//, "").replace(/\/+$/, "");
  const aud = (env.ACCESS_AUD || "").trim();
  const admins = (env.ADMIN_EMAILS || "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
  if (!team || !aud || !admins.length) return { ok: false, reason: "admin access is not configured" };

  const token = request.headers.get("Cf-Access-Jwt-Assertion")
    || (request.headers.get("Cookie") || "").match(/(?:^|;\s*)CF_Authorization=([^;]+)/)?.[1];
  if (!token) return { ok: false, reason: "not signed in" };

  const parts = token.split(".");
  if (parts.length !== 3) return { ok: false, reason: "malformed token" };

  let header, payload;
  try { header = b64urlJson(parts[0]); payload = b64urlJson(parts[1]); }
  catch { return { ok: false, reason: "malformed token" }; }
  if (header.alg !== "RS256" || !header.kid) return { ok: false, reason: "unexpected token type" };

  // Certificates come only from the configured team domain (ACCESS_CERTS_URL exists for local tests only).
  const certsUrl = env.ACCESS_CERTS_URL || `https://${team}/cdn-cgi/access/certs`;
  let keys;
  try { keys = await getKeys(certsUrl); } catch { return { ok: false, reason: "could not load Access keys" }; }
  const jwk = keys.find((k) => k.kid === header.kid);
  if (!jwk) return { ok: false, reason: "unknown signing key" };

  const key = await crypto.subtle.importKey(
    "jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]
  );
  const valid = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5", key, b64urlToBytes(parts[2]),
    new TextEncoder().encode(`${parts[0]}.${parts[1]}`)
  );
  if (!valid) return { ok: false, reason: "bad signature" };

  const now = Math.floor(Date.now() / 1000);
  const auds = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!auds.includes(aud)) return { ok: false, reason: "wrong audience" };
  if (payload.iss !== `https://${team}`) return { ok: false, reason: "wrong issuer" };
  if (typeof payload.exp !== "number" || payload.exp < now - 30) return { ok: false, reason: "session expired" };
  if (typeof payload.nbf === "number" && payload.nbf > now + 30) return { ok: false, reason: "token not yet valid" };

  const email = String(payload.email || "").toLowerCase();
  if (!email || !admins.includes(email)) return { ok: false, reason: "this account is not allowed" };
  return { ok: true, email };
}
