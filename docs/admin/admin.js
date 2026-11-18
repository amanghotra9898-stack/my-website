/* SDX PLAYS — private analytics dashboard.
   Data comes only from /api/admin/stats (same origin, protected by the admin session cookie).
   Everything is rendered with textContent / createElement — no innerHTML with data. */
(function () {
  "use strict";
  var SVGNS = "http://www.w3.org/2000/svg";
  var BUTTON_NAMES = {
    hero: "Home hero", screenshots: "Home screenshots section", "card-home": "Home game card",
    "card-games": "Games page card", titlebar: "Game page — title bar", sidebar: "Game page — sidebar", other: "Other"
  };
  var PAGE_NAMES = { "/": "Home", "/games": "Games", "/medieval-life": "Medieval Life", "/about": "About", "/contact": "Contact", "/404": "404" };
  var days = 30, lastData = null;

  function $(id) { return document.getElementById(id); }
  function el(tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }
  function svg(tag, attrs) { var n = document.createElementNS(SVGNS, tag); for (var k in attrs) n.setAttribute(k, attrs[k]); return n; }
  function clear(n) { while (n.firstChild) n.removeChild(n.firstChild); }
  function fmt(n) { return Number(n || 0).toLocaleString("en-IN"); }
  function status(msg, isErr) { var s = $("status"); s.textContent = msg; s.classList.toggle("error", !!isErr); }

  /* ---------- KPI cards ---------- */
  function kpis(sum) {
    var box = $("kpis"); clear(box);
    [["Today", "today"], ["Last 7 days", "last7"], ["Last 30 days", "last30"], ["All time", "all"]].forEach(function (w) {
      var s = sum[w[1]] || {};
      var card = el("article", "kpi"); card.appendChild(el("h3", null, w[0]));
      var dl = el("dl");
      [["Visitors", s.visitors, true], ["Page views", s.pageviews], ["Download clicks", s.clicks, true], ["Unique clickers", s.clickers]].forEach(function (r) {
        dl.appendChild(el("dt", null, r[0])); dl.appendChild(el("dd", r[2] ? "hl" : null, fmt(r[1])));
      });
      card.appendChild(dl); box.appendChild(card);
    });
  }

  /* ---------- Trend chart (SVG) ---------- */
  function trend(series) {
    var box = $("trend"); clear(box);
    var W = Math.max(box.clientWidth || 600, 300), H = W < 500 ? 220 : 260;
    var pad = { l: 38, r: 12, t: 14, b: 26 }, iw = W - pad.l - pad.r, ih = H - pad.t - pad.b;
    var max = 1; series.forEach(function (d) { max = Math.max(max, d.pageviews, d.visitors, d.clicks); });
    var step = Math.pow(10, Math.floor(Math.log10(max))); var top = Math.ceil(max / step) * step; if (top < 4) top = 4;
    var n = series.length, xw = iw / Math.max(n, 1);
    function x(i) { return pad.l + xw * i + xw / 2; }
    function y(v) { return pad.t + ih - (v / top) * ih; }
    var s = svg("svg", { viewBox: "0 0 " + W + " " + H, role: "img" });
    for (var g = 0; g <= 4; g++) {
      var gy = pad.t + ih * g / 4;
      s.appendChild(svg("line", { x1: pad.l, x2: W - pad.r, y1: gy, y2: gy, "class": "grid" }));
      var t = svg("text", { x: pad.l - 6, y: gy + 4, "text-anchor": "end", "class": "axis" }); t.textContent = fmt(Math.round(top * (4 - g) / 4)); s.appendChild(t);
    }
    var bw = Math.max(2, Math.min(14, xw * 0.45));
    series.forEach(function (d, i) {
      if (d.clicks) s.appendChild(svg("rect", { x: x(i) - bw / 2, y: y(d.clicks), width: bw, height: pad.t + ih - y(d.clicks), rx: 2, "class": "cl" }));
    });
    function path(key) { return series.map(function (d, i) { return (i ? "L" : "M") + x(i).toFixed(1) + " " + y(d[key]).toFixed(1); }).join(" "); }
    if (n) {
      s.appendChild(svg("path", { d: path("pageviews") + " L" + x(n - 1).toFixed(1) + " " + (pad.t + ih) + " L" + x(0).toFixed(1) + " " + (pad.t + ih) + " Z", "class": "pv-area" }));
      s.appendChild(svg("path", { d: path("pageviews"), "class": "pv" }));
      s.appendChild(svg("path", { d: path("visitors"), "class": "vi" }));
    }
    var every = Math.ceil(n / (W < 500 ? 4 : 8));
    series.forEach(function (d, i) {
      if (i % every && i !== n - 1) return;
      var t = svg("text", { x: x(i), y: H - 6, "text-anchor": "middle", "class": "axis" });
      t.textContent = d.day.slice(5).replace("-", "/"); s.appendChild(t);
    });
    // hover / tap tooltip
    var hl = svg("line", { y1: pad.t, y2: pad.t + ih, "class": "hover-line", visibility: "hidden" });
    var tipG = svg("g", { visibility: "hidden" });
    var tipR = svg("rect", { width: 150, height: 66, rx: 6, "class": "tip" });
    var tipT = [0, 1, 2, 3].map(function (k) { var t = svg("text", { x: 10, y: 18 + k * 15, "class": "tip-t" }); tipG.appendChild(t); return t; });
    tipG.insertBefore(tipR, tipG.firstChild); s.appendChild(hl); s.appendChild(tipG);
    function show(evt) {
      var r = s.getBoundingClientRect(), px = (evt.clientX - r.left) * (W / r.width);
      var i = Math.min(n - 1, Math.max(0, Math.floor((px - pad.l) / xw))); var d = series[i]; if (!d) return;
      hl.setAttribute("x1", x(i)); hl.setAttribute("x2", x(i)); hl.setAttribute("visibility", "visible");
      tipT[0].textContent = d.day; tipT[1].textContent = "Page views: " + fmt(d.pageviews);
      tipT[2].textContent = "Visitors: " + fmt(d.visitors); tipT[3].textContent = "Download clicks: " + fmt(d.clicks);
      var tx = Math.min(W - 156, Math.max(pad.l, x(i) + 8)); tipG.setAttribute("transform", "translate(" + tx + "," + (pad.t + 4) + ")");
      tipG.setAttribute("visibility", "visible");
    }
    s.addEventListener("pointermove", show); s.addEventListener("pointerdown", show);
    s.addEventListener("pointerleave", function () { hl.setAttribute("visibility", "hidden"); tipG.setAttribute("visibility", "hidden"); });
    box.appendChild(s);
  }

  /* ---------- Bar lists ---------- */
  function bars(id, rows, keyName, names) {
    var box = $(id); clear(box);
    if (!rows || !rows.length) { box.appendChild(el("p", "empty", "No data yet")); return; }
    var max = rows.reduce(function (m, r) { return Math.max(m, r.n); }, 1);
    rows.forEach(function (r) {
      var key = r[keyName] == null ? "Unknown" : String(r[keyName]);
      var row = el("div", "bar-row");
      row.appendChild(el("span", "label", (names && names[key]) || key));
      row.appendChild(el("span", "val", fmt(r.n)));
      var tr = el("div", "track"), f = el("div", "fill"); f.style.width = Math.max(2, Math.round(r.n / max * 100)) + "%";
      tr.appendChild(f); row.appendChild(tr); box.appendChild(row);
    });
  }

  function recent(rows) {
    var tb = $("recent"); clear(tb);
    if (!rows || !rows.length) { var tr = el("tr"), td = el("td", "empty", "No download-button clicks yet"); td.colSpan = 5; tr.appendChild(td); tb.appendChild(tr); return; }
    var f = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" });
    rows.forEach(function (r) {
      var tr = el("tr");
      [f.format(new Date(r.ts)), BUTTON_NAMES[r.button] || r.button || "—", PAGE_NAMES[r.path] || r.path, r.device || "—", r.country || "—"]
        .forEach(function (v) { tr.appendChild(el("td", null, String(v))); });
      tb.appendChild(tr);
    });
  }

  function render(d) {
    lastData = d;
    $("who").textContent = d.admin || "";
    kpis(d.summary || {});
    trend(d.series || []);
    bars("buttons", d.buttons, "button", BUTTON_NAMES);
    bars("pages", d.pages, "path", PAGE_NAMES);
    bars("devices", d.devices, "device");
    bars("countries", d.countries, "country");
    bars("referrers", d.referrers, "referrer");
    $("gh").textContent = d.githubApkRequests == null ? "Unavailable" : fmt(d.githubApkRequests);
    recent(d.recentClicks);
    status("Updated " + new Date(d.generatedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) + " IST · last " + d.days + " days in charts");
  }

  function load() {
    status("Loading analytics…");
    fetch("/api/admin/stats?days=" + days, { credentials: "same-origin", cache: "no-store", headers: { Accept: "application/json" } })
      .then(function (r) {
        if (r.status === 401) { location.replace("/admin/login"); throw new Error("Session ended — redirecting to sign in…"); }
        if (r.status === 403) throw new Error("Access denied — please sign in again.");
        if (!r.ok) throw new Error("Could not load analytics (HTTP " + r.status + ").");
        return r.json();
      })
      .then(render)
      .catch(function (e) { status(e.message || "Could not load analytics.", true); });
  }

  document.querySelectorAll(".range [data-days]").forEach(function (b) {
    b.addEventListener("click", function () {
      days = Number(b.getAttribute("data-days"));
      document.querySelectorAll(".range [data-days]").forEach(function (x) { x.setAttribute("aria-pressed", x === b ? "true" : "false"); });
      load();
    });
  });
  $("refresh").addEventListener("click", load);
  var rt; window.addEventListener("resize", function () { clearTimeout(rt); rt = setTimeout(function () { if (lastData) trend(lastData.series || []); }, 200); });
  // Session: fetch the per-session CSRF token used for sign-out.
  var csrf = null;
  fetch("/api/auth/session", { credentials: "same-origin", cache: "no-store" })
    .then(function (r) { if (r.status === 401) { location.replace("/admin/login"); return null; } return r.ok ? r.json() : null; })
    .then(function (s) {
      if (!s) return;
      csrf = s.csrf;
      // Separate element: never overwritten by the analytics status line.
      if (typeof s.recoveryRemaining === "number" && s.recoveryRemaining < 3) {
        $("rec-warn").textContent = "Warning: only " + s.recoveryRemaining + " recovery code" + (s.recoveryRemaining === 1 ? "" : "s") + " left. Create new ones with the setup tool (\u201cNew recovery codes only\u201d).";
        $("rec-warn").hidden = false;
      }
    }).catch(function () {});
  function signOut(all) {
    if (!csrf) { location.replace("/admin/login"); return; }
    fetch(all ? "/api/auth/logout-all" : "/api/auth/logout", { method: "POST", credentials: "same-origin", cache: "no-store", headers: { "X-CSRF-Token": csrf } })
      .finally(function () { csrf = null; location.replace("/admin/login"); });
  }
  $("logout").addEventListener("click", function () { signOut(false); });
  $("logout-all").addEventListener("click", function () { signOut(true); });
  load();
})();
