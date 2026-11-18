/* SDX PLAYS admin sign-in.
   The password never leaves this page: a Web Worker turns username + password into a key with scrypt
   (128 MiB, a few seconds), and only that key is sent in the POST body over HTTPS. The key is treated
   like a password: never logged, never stored (no localStorage/sessionStorage/cookies), never in a URL. */

const $ = (id) => document.getElementById(id);
const form = $("login"), msg = $("msg"), go = $("go");
let useRecovery = false;

const policy = window.trustedTypes
  ? window.trustedTypes.createPolicy("sdx-admin", {
      createScriptURL: (u) => { if (u === "/admin/scrypt-worker.js") return u; throw new TypeError("Blocked script URL"); },
    })
  : null;

function say(text, bad) { msg.textContent = text; msg.classList.toggle("error", !!bad); }
function b64u(bytes) { let s = ""; for (const b of bytes) s += String.fromCharCode(b); return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); }

if (location.protocol !== "https:") { say("Sign-in works only over HTTPS.", true); go.disabled = true; }

// Already signed in? Go straight to the dashboard.
fetch("/api/auth/session", { credentials: "same-origin", cache: "no-store" })
  .then((r) => { if (r.ok) location.replace("/admin/"); }).catch(() => {});

$("switch").addEventListener("click", () => {
  useRecovery = !useRecovery;
  $("totp-row").hidden = useRecovery; $("rec-row").hidden = !useRecovery;
  $("switch").textContent = useRecovery ? "Use authenticator code instead" : "Use a recovery code instead";
  (useRecovery ? $("r") : $("c")).focus();
});

function derive(params, u, p) {
  return new Promise((resolve, reject) => {
    const url = "/admin/scrypt-worker.js";
    const w = new Worker(policy ? policy.createScriptURL(url) : url, { type: "module" });
    const done = (fn, v) => { w.terminate(); fn(v); };
    w.onmessage = (e) => (e.data && e.data.ok ? done(resolve, e.data.key) : done(reject, new Error("derive")));
    w.onerror = () => done(reject, new Error("derive"));
    w.postMessage({ u, p, salt: params.salt, N: params.N, r: params.r, p_: params.p, dkLen: params.dkLen });
  });
}

form.addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const u = $("u").value, p = $("p").value;
  const code = useRecovery ? $("r").value.trim() : $("c").value.trim();
  if (!u || !p || !code) { say("Enter your username, password and code.", true); return; }
  if (!useRecovery && !/^\d{6}$/.test(code)) { say("The authenticator code is 6 digits.", true); return; }
  go.disabled = true;
  say("Checking… this can take a few seconds.");
  let key = null;
  try {
    const pr = await fetch("/api/auth/params", { credentials: "same-origin", cache: "no-store" });
    if (!pr.ok) throw new Error("params");
    const params = await pr.json();
    if (params.N !== 131072 || params.r !== 8 || params.p !== 1 || params.dkLen !== 32) throw new Error("params");
    key = await derive(params, u, p);
    const body = { k: b64u(key) };
    if (useRecovery) body.recovery = code; else body.totp = code;
    const res = await fetch("/api/auth/login", {
      method: "POST", credentials: "same-origin", cache: "no-store",
      headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.ok) {
      $("p").value = ""; $("c").value = ""; $("r").value = "";
      if (typeof data.recoveryRemaining === "number") {
        say("Signed in with a recovery code. " + data.recoveryRemaining + " recovery codes left — set up new ones soon.");
        setTimeout(() => location.replace("/admin/"), 4000);
      } else location.replace("/admin/");
      return;
    }
    say(res.status === 429 ? "Too many attempts. Please wait and try again later." : "Invalid username, password or code.", true);
  } catch {
    say("Sign-in failed. Check your connection and try again.", true);
  } finally {
    if (key) key.fill(0);
    $("c").value = ""; $("r").value = "";
    go.disabled = false;
  }
});
