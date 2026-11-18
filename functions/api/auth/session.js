// GET /api/auth/session — 200 {ok, csrf, recoveryRemaining} for a valid session, otherwise 401.
import { getSession, csrfFor, authJson, isHttps, httpsRequired, recoveryRemaining, clearCookie } from "../../_lib/auth.js";

export async function onRequestGet({ request, env }) {
  if (!isHttps(request)) return httpsRequired();
  const s = await getSession(request, env);
  if (!s) return authJson({ ok: false }, 401, { "Set-Cookie": clearCookie() });
  return authJson({ ok: true, csrf: await csrfFor(s), recoveryRemaining: await recoveryRemaining(env, s.cfg) });
}
