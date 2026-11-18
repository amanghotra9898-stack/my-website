// Every /api/admin/* request needs a valid admin session (cookie). State-changing methods also need the CSRF token.
import { getSession, checkCsrf, sameOriginPost, isHttps, httpsRequired, authJson } from "../../_lib/auth.js";

export async function onRequest(context) {
  const { request, env } = context;
  if (!isHttps(request)) return httpsRequired();
  const s = await getSession(request, env);
  if (!s) return authJson({ error: "unauthorized" }, 401);
  if (!["GET", "HEAD"].includes(request.method) && (!sameOriginPost(request) || !(await checkCsrf(request, s)))) {
    return authJson({ error: "forbidden" }, 403);
  }
  context.data.adminUser = "admin";
  return context.next();
}
