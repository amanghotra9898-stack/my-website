// GET /api/auth/params — public scrypt parameters for the browser (same answer for everyone).
import { publicParams, authJson, isHttps, httpsRequired } from "../../_lib/auth.js";

export async function onRequestGet({ request, env }) {
  if (!isHttps(request)) return httpsRequired();
  return authJson(await publicParams(env, new URL(request.url).host));
}
