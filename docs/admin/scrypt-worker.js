// SDX PLAYS admin — derives the login key in a background thread so the page stays responsive.
// Input and output never leave this page except as the POST body to /api/auth/login. Nothing is logged or stored.
import { scrypt } from "./vendor/noble-hashes/scrypt.js";

self.onmessage = function (e) {
  const m = e.data || {};
  try {
    const enc = new TextEncoder();
    const user = String(m.u || "").trim().toLowerCase().normalize("NFKC");
    const pass = enc.encode(user + "\u0000" + String(m.p || "").normalize("NFKC"));
    const salt = Uint8Array.from(atob(m.salt.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((m.salt.length + 3) % 4)), (c) => c.charCodeAt(0));
    const key = scrypt(pass, salt, { N: m.N, r: m.r, p: m.p_, dkLen: m.dkLen });
    pass.fill(0);
    self.postMessage({ ok: true, key }, [key.buffer]);
  } catch {
    self.postMessage({ ok: false });
  }
};
