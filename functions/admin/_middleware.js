// Runs before every /admin/* request (including the static dashboard files).
// Second lock behind Cloudflare Access: no valid admin session → 403, page never served.

import { verifyAccess } from "../_lib/access.js";
import { SECURITY_HEADERS } from "../_lib/util.js";

export async function onRequest(context) {
  const auth = await verifyAccess(context.request, context.env);
  if (!auth.ok) {
    return new Response(
      `<!doctype html><meta charset="utf-8"><title>403 – Forbidden</title><meta name="robots" content="noindex">` +
      `<body style="background:#03060f;color:#e8f1ff;font:16px system-ui;display:grid;place-items:center;height:100vh;margin:0">` +
      `<p>403 – Admin access only.</p></body>`,
      { status: 403, headers: { ...SECURITY_HEADERS, "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'", "Content-Type": "text/html; charset=utf-8" } }
    );
  }
  const res = await context.next();
  const out = new Response(res.body, res);
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) out.headers.set(k, v);
  return out;
}
