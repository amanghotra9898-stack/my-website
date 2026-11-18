// Runs before every /admin/* request (including static dashboard files).
// Login page assets are public; everything else needs a valid admin session.
import { getSession, isHttps, ADMIN_HEADERS } from "../_lib/auth.js";

const PUBLIC = new Set(["/admin/login", "/admin/login.html", "/admin/login.js", "/admin/scrypt-worker.js", "/admin/admin.css"]);

function withHeaders(res) {
  const out = new Response(res.body, res);
  for (const [k, v] of Object.entries(ADMIN_HEADERS)) out.headers.set(k, v);
  return out;
}

export async function onRequest(context) {
  const { request, env } = context;
  if (!isHttps(request)) return withHeaders(new Response("HTTPS required.", { status: 403, headers: { "Content-Type": "text/plain; charset=utf-8" } }));
  const path = new URL(request.url).pathname;
  const isPublic = PUBLIC.has(path) || path.startsWith("/admin/vendor/");
  if (!isPublic && !(await getSession(request, env))) {
    const page = path === "/admin" || path === "/admin/" || path.endsWith(".html") || !/\.[a-z0-9]+$/i.test(path);
    return withHeaders(page
      ? new Response(null, { status: 302, headers: { Location: "/admin/login" } })
      : new Response("Unauthorized", { status: 401, headers: { "Content-Type": "text/plain; charset=utf-8" } }));
  }
  return withHeaders(await context.next());
}
