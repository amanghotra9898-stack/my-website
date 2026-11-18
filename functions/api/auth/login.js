// POST /api/auth/login — body {k, totp} or {k, recovery}. K is the browser-side scrypt output (password-equivalent):
// it is never logged, stored, echoed or placed in a URL. Every credential failure gives the same 401 answer.
import { 
  loadConfig, isHttps, httpsRequired, sameOriginPost, authJson, GENERIC_FAIL, RATE_LIMITED,
  srcHash, reserveAttempt, releaseAttempt, verifyDerivedKey, matchTotp, consumeTotp,
  matchRecovery, consumeRecovery, createSession, revokeSession, recoveryRemaining, csrfFor, sha256, b64u, COOKIE,
} from "../../_lib/auth.js";

export async function onRequestPost({ request, env }) {
  if (!isHttps(request)) return httpsRequired();
  if (!sameOriginPost(request)) return authJson({ error: "Forbidden." }, 403);
  if (!(request.headers.get("Content-Type") || "").startsWith("application/json")) return authJson({ error: "Bad request." }, 415);
  if (!env.DB) return authJson({ error: "Login is unavailable." }, 503);

  const text = await request.text();
  if (text.length > 1024) return authJson({ error: "Bad request." }, 413);
  let body; try { body = JSON.parse(text); } catch { return authJson({ error: "Bad request." }, 400); }
  if (!body || typeof body !== "object") return authJson({ error: "Bad request." }, 400);
  const k = typeof body.k === "string" ? body.k : "";
  const totp = typeof body.totp === "string" ? body.totp.trim() : "";
  const recovery = typeof body.recovery === "string" ? body.recovery : "";

  const now = Date.now();
  const slot = await reserveAttempt(env, await srcHash(env, request), now);
  if (slot == null) return authJson(RATE_LIMITED, 429, { "Retry-After": "900" });

  const cfg = loadConfig(env);
  const keyOk = await verifyDerivedKey(cfg, k);
  let ok = false, usedRecovery = false;
  if (totp && !recovery) {
    const step = await matchTotp(cfg, totp, now);
    ok = keyOk && step !== null && await consumeTotp(env, step, now);   // a code is consumed only with a valid password
  } else if (recovery && !totp) {
    const h = await matchRecovery(cfg, recovery);
    ok = keyOk && h !== null && await consumeRecovery(env, h, now);
    usedRecovery = ok;
  }
  if (!ok) return authJson(GENERIC_FAIL, 401);

  await releaseAttempt(env, slot);
  // Session fixation defence: any session the browser already had is destroyed; a brand-new token is issued.
  const old = (request.headers.get("Cookie") || "").match(/(?:^|;\s*)__Host-sdx_admin=([A-Za-z0-9_-]{43})/);
  if (old) await revokeSession(env, b64u(await sha256("session|" + old[1])));
  const s = await createSession(env, cfg, request, now);
  const out = { ok: true, csrf: await csrfFor({ token: s.token, cfg }) };
  if (usedRecovery) out.recoveryRemaining = await recoveryRemaining(env, cfg);
  return authJson(out, 200, { "Set-Cookie": s.cookie });
}

export function onRequest() { return authJson({ error: "Method not allowed." }, 405, { Allow: "POST" }); }
