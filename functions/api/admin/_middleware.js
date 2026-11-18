// Every /api/admin/* request must carry a valid Cloudflare Access session for an allowed admin.
import { verifyAccess } from "../../_lib/access.js";
import { json } from "../../_lib/util.js";

export async function onRequest(context) {
  const auth = await verifyAccess(context.request, context.env);
  if (!auth.ok) return json({ error: "forbidden" }, 403);
  context.data.adminEmail = auth.email;
  return context.next();
}
