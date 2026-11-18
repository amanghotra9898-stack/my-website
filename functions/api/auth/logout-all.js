// POST /api/auth/logout-all — needs a valid session, same-origin request and the session's CSRF token.
import { getSession, checkCsrf, sameOriginPost, authJson, isHttps, httpsRequired, clearCookie, revokeSession, revokeAllSessions } from "../../_lib/auth.js";

export async function onRequestPost({ request, env }) {
  if (!isHttps(request)) return httpsRequired();
  if (!sameOriginPost(request)) return authJson({ error: "Forbidden." }, 403);
  const s = await getSession(request, env);
  if (!s) return authJson({ ok: false }, 401, { "Set-Cookie": clearCookie() });
  if (!(await checkCsrf(request, s))) return authJson({ error: "Forbidden." }, 403);
  await revokeAllSessions(env);
  return authJson({ ok: true }, 200, { "Set-Cookie": clearCookie() });
}

export function onRequest() { return authJson({ error: "Method not allowed." }, 405, { Allow: "POST" }); }
