/* SDX PLAYS — main site script (no dependencies)
   Security notes:
   - All dynamic content (from site-data.js) is rendered with textContent / setAttribute.
     No innerHTML, document.write, eval or new Function with data values.
   - Every URL is validated by safeUrl()/safePath() before use; javascript:, data:, http: etc. are rejected.
   - External links always open with rel="noopener noreferrer". */
(function () {
  "use strict";
  var D = window.SDX || {};
  var SITE = D.site || {}, SOCIAL = D.social || {};
  var GAMES = Array.isArray(D.games) ? D.games : [];
  document.documentElement.classList.remove("no-js");

  /* ---------- URL validation ---------- */
  // Site-relative file path: letters, digits, . _ - / only; no "..", no leading slash/scheme.
  function safePath(u) {
    return typeof u === "string" && /^[a-z0-9][a-z0-9._\-\/]*$/i.test(u) && u.indexOf("..") === -1 && u.indexOf("//") === -1 ? u : null;
  }
  // External link: https only, valid URL, no credentials in it.
  function safeHttps(u) {
    if (typeof u !== "string") return null;
    u = u.trim();
    if (!/^https:\/\//i.test(u)) return null;
    try { var p = new URL(u); return p.protocol === "https:" && !p.username && !p.password ? p.href : null; } catch (e) { return null; }
  }
  function safeUrl(u) { return safeHttps(u) || safePath(typeof u === "string" ? u.trim() : u); }
  function str(v) { return typeof v === "string" ? v : ""; }

  /* ---------- Safe DOM helpers ---------- */
  function el(tag, attrs, children) {
    var n = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === "text") n.textContent = attrs[k];
      else if (attrs[k] !== null && attrs[k] !== undefined) n.setAttribute(k, attrs[k]);
    });
    (children || []).forEach(function (c) { if (c) n.appendChild(typeof c === "string" ? document.createTextNode(c) : c); });
    return n;
  }
  function setExternal(a, url) {
    a.setAttribute("href", url);
    if (/^https:/i.test(url)) { a.setAttribute("target", "_blank"); a.setAttribute("rel", "noopener noreferrer"); }
  }

  /* Static, trusted SVG icons (constants written in this file — never user data).
     Parsed once with DOMParser as SVG, then cloned. */
  var SVG_NS = 'xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false"';
  var ICONS = {
    youtube: '<svg ' + SVG_NS + ' viewBox="0 0 24 24" fill="currentColor"><path d="M23 7.2a3 3 0 0 0-2.1-2.1C19 4.6 12 4.6 12 4.6s-7 0-8.9.5A3 3 0 0 0 1 7.2 31 31 0 0 0 .5 12a31 31 0 0 0 .5 4.8 3 3 0 0 0 2.1 2.1c1.9.5 8.9.5 8.9.5s7 0 8.9-.5a3 3 0 0 0 2.1-2.1 31 31 0 0 0 .5-4.8 31 31 0 0 0-.5-4.8ZM9.8 15.1V8.9l5.7 3.1-5.7 3.1Z"/></svg>',
    discord: '<svg ' + SVG_NS + ' viewBox="0 0 24 24" fill="currentColor"><path d="M20.3 4.4A19.6 19.6 0 0 0 15.4 3l-.6 1.3a18 18 0 0 0-5.5 0L8.6 3a19.5 19.5 0 0 0-4.9 1.5C.6 9.1-.3 13.6.1 18.1A19.8 19.8 0 0 0 6.1 21l1.3-2.1a12.7 12.7 0 0 1-2-1l.5-.4a14 14 0 0 0 12.2 0l.5.4c-.6.4-1.3.7-2 1l1.3 2.1a19.7 19.7 0 0 0 6-3c.5-5.2-.8-9.7-3.6-13.6ZM8.3 15.4c-1.2 0-2.2-1.1-2.2-2.4s1-2.4 2.2-2.4 2.2 1.1 2.2 2.4-1 2.4-2.2 2.4Zm7.4 0c-1.2 0-2.2-1.1-2.2-2.4s1-2.4 2.2-2.4 2.2 1.1 2.2 2.4-1 2.4-2.2 2.4Z"/></svg>',
    instagram: '<svg ' + SVG_NS + ' viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor"/></svg>',
    telegram: '<svg ' + SVG_NS + ' viewBox="0 0 24 24" fill="currentColor"><path d="M21.9 4.3 18.7 19.4c-.2 1-.9 1.3-1.8.8l-4.9-3.6-2.4 2.3c-.3.3-.5.5-1 .5l.3-5 9.1-8.2c.4-.4-.1-.6-.6-.2L6.2 13 1.4 11.5c-1-.3-1-1 .2-1.5L20.5 2.8c.9-.3 1.6.2 1.4 1.5Z"/></svg>',
    arrow: '<svg ' + SVG_NS + ' viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="m9 18 6-6-6-6"/></svg>',
    image: '<svg ' + SVG_NS + ' viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 17-5-5-8 8"/></svg>'
  };
  var iconCache = {};
  function icon(name) {
    if (!iconCache[name]) iconCache[name] = new DOMParser().parseFromString(ICONS[name], "image/svg+xml").documentElement;
    return document.importNode(iconCache[name], true);
  }
  var NAMES = { youtube: "YouTube", discord: "Discord", instagram: "Instagram", telegram: "Telegram" };
  function gameById(id) { for (var i = 0; i < GAMES.length; i++) if (GAMES[i] && GAMES[i].id === id) return GAMES[i]; return null; }
  function gamePage(g) { return safePath(g && g.page) || "games.html"; }

  /* ---------- Social links (only https links become clickable) ---------- */
  document.querySelectorAll("[data-socials]").forEach(function (box) {
    ["youtube", "discord", "instagram", "telegram"].forEach(function (k) {
      var u = safeHttps(SOCIAL[k]);
      if (u) { var a = el("a", { "aria-label": "SDX PLAYS on " + NAMES[k] }, [icon(k)]); setExternal(a, u); box.appendChild(a); }
      else box.appendChild(el("span", { title: NAMES[k] + " link coming soon", "aria-label": NAMES[k] + " (coming soon)", role: "img" }, [icon(k)]));
    });
  });

  /* ---------- Contact emails ---------- */
  document.querySelectorAll("[data-contact]").forEach(function (n) {
    var v = str(SITE[n.getAttribute("data-contact")]).trim();
    if (/^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$/.test(v)) {
      n.textContent = "";
      n.appendChild(el("a", { href: "mailto:" + v, text: v }));
    }
  });

  /* ---------- Download buttons ----------
     <a data-download="game-id" data-platform="android|web|any">
     A button only appears when a valid https download URL exists; otherwise it (and any
     wrapper marked data-download-wrap) is hidden — never a broken or fake link. */
  function downloadUrl(g, p) {
    var dl = (g && g.downloads) || {};
    return p === "any" ? (safeHttps(dl.android) || safeHttps(dl.web)) : safeHttps(dl[p]);
  }
  function wireDownload(b) {
    var g = gameById(b.getAttribute("data-download"));
    var url = downloadUrl(g, b.getAttribute("data-platform") || "any");
    if (url) { setExternal(b, url); b.hidden = false; }
    else { b.removeAttribute("href"); b.hidden = true; }
  }
  function wireDownloadWraps() {
    document.querySelectorAll("[data-download-wrap]").forEach(function (w) {
      var visible = w.querySelectorAll("[data-download]:not([hidden])").length > 0;
      w.hidden = !visible;
    });
    // APK version / size labels (only real values from site-data.js)
    document.querySelectorAll("[data-apk-meta]").forEach(function (n) {
      var g = gameById(n.getAttribute("data-apk-meta")), a = (g && g.apk) || {};
      var parts = [];
      if (str(a.version).trim()) parts.push("Version " + str(a.version).trim());
      if (str(a.size).trim()) parts.push(str(a.size).trim());
      parts.push("Android APK");
      n.textContent = parts.join(" \u2022 ");
    });
  }

  /* ---------- Games grid (rendered from site-data.js) ---------- */
  document.querySelectorAll("[data-games-grid]").forEach(function (grid) {
    var feat = grid.hasAttribute("data-feature-first");
    while (grid.firstChild) grid.removeChild(grid.firstChild);
    if (!GAMES.length) { grid.appendChild(el("div", { class: "empty-state" }, [el("p", { text: "No games are published yet. Check back soon!" })])); return; }
    GAMES.forEach(function (g, i) {
      var page = gamePage(g), cover = safePath(g.cover);
      var media = el("a", { class: "media", href: page, tabindex: "-1", "aria-hidden": "true" },
        cover ? [el("img", { src: cover, alt: "", loading: i === 0 ? "eager" : "lazy", decoding: "async", width: "1600", height: "481" })] : []);
      var tags = el("div", { class: "tags" }, (Array.isArray(g.tags) ? g.tags : []).map(function (t) { return el("span", { class: "tag", text: str(t) }); }));
      var dl = el("a", { class: "btn btn-ghost btn-sm", "data-download": str(g.id) }, [el("span", { text: "Download" })]);
      var body = el("div", { class: "body" }, [
        tags,
        el("h3", {}, [el("a", { href: page, class: "plain", text: str(g.title) })]),
        el("p", { text: str(g.short) }),
        el("div", { class: "actions" }, [el("a", { class: "btn btn-primary btn-sm", href: page }, ["View details ", icon("arrow")]), dl])
      ]);
      grid.appendChild(el("article", { class: "game-card" + (feat && i === 0 ? " featured" : "") }, [media, body]));
    });
  });
  document.querySelectorAll("[data-download]").forEach(wireDownload);
  wireDownloadWraps();

  /* ---------- Screenshot gallery + lightbox ---------- */
  var lb, lbImg, lbCap, lbList = [], lbIdx = 0, lbReturn;
  function normShot(x, title, i) {
    if (typeof x === "string") x = { src: x };
    if (!x || typeof x !== "object") return null;
    var src = safePath(x.src); if (!src) return null;
    return { src: src, thumb: safePath(x.thumb) || src, alt: str(x.alt) || (title + " gameplay screenshot " + (i + 1)) };
  }
  document.querySelectorAll("[data-gallery]").forEach(function (box) {
    var g = gameById(box.getAttribute("data-gallery")), title = str(g && g.title);
    var shots = ((g && Array.isArray(g.screenshots)) ? g.screenshots : []).map(function (x, i) { return normShot(x, title, i); }).filter(Boolean);
    var limit = parseInt(box.getAttribute("data-limit") || "0", 10);
    if (!shots.length) {
      var wrap = box.closest("[data-gallery-section]"); if (wrap) wrap.hidden = true; else box.hidden = true;
      return;
    }
    shots.forEach(function (sh, i) {
      if (limit && i >= limit) return;
      var b = el("button", { type: "button", class: "shot", "aria-label": "View larger: " + sh.alt },
        [el("img", { src: sh.thumb, alt: sh.alt, loading: "lazy", decoding: "async", width: "640", height: "360" }), el("span", { class: "zoom", "aria-hidden": "true", text: "\u2922" })]);
      b.addEventListener("click", function () { openLightbox(shots, i); });
      box.appendChild(b);
    });
  });
  function openLightbox(list, i) {
    if (!lb) {
      lbImg = el("img", { alt: "" });
      lbCap = el("p", { class: "lb-cap" });
      var close = el("button", { class: "icon-btn close", "aria-label": "Close", text: "\u00d7" });
      var prev = el("button", { class: "icon-btn nav-btn prev", "aria-label": "Previous screenshot", text: "\u2039" });
      var next = el("button", { class: "icon-btn nav-btn next", "aria-label": "Next screenshot", text: "\u203a" });
      lb = el("div", { class: "lightbox", role: "dialog", "aria-modal": "true", "aria-label": "Screenshot viewer" }, [close, prev, el("figure", { class: "lb-fig" }, [lbImg, lbCap]), next]);
      document.body.appendChild(lb);
      close.addEventListener("click", closeLightbox);
      prev.addEventListener("click", function () { showLb(lbIdx - 1); });
      next.addEventListener("click", function () { showLb(lbIdx + 1); });
      lb.addEventListener("click", function (e) { if (e.target === lb || e.target.classList.contains("lb-fig")) closeLightbox(); });
      // swipe on touch screens
      var x0 = null;
      lb.addEventListener("touchstart", function (e) { x0 = e.touches[0].clientX; }, { passive: true });
      lb.addEventListener("touchend", function (e) {
        if (x0 === null) return; var dx = e.changedTouches[0].clientX - x0; x0 = null;
        if (Math.abs(dx) > 50) showLb(lbIdx + (dx < 0 ? 1 : -1));
      }, { passive: true });
    }
    lbReturn = document.activeElement; lbList = list;
    lb.querySelector(".prev").hidden = lb.querySelector(".next").hidden = list.length < 2;
    showLb(i); lb.classList.add("open"); document.body.classList.add("no-scroll"); lb.querySelector(".close").focus();
  }
  function showLb(i) {
    lbIdx = (i + lbList.length) % lbList.length;
    lbImg.src = lbList[lbIdx].src; lbImg.alt = lbList[lbIdx].alt;
    lbCap.textContent = lbList[lbIdx].alt + "  (" + (lbIdx + 1) + " / " + lbList.length + ")";
  }
  function closeLightbox() { lb.classList.remove("open"); document.body.classList.remove("no-scroll"); if (lbReturn) lbReturn.focus(); }

  /* ---------- Mobile menu ---------- */
  var tog = document.querySelector(".menu-toggle"), links = document.getElementById("nav-links");
  function setMenu(open) {
    links.classList.toggle("open", open);
    tog.setAttribute("aria-expanded", open ? "true" : "false");
    tog.setAttribute("aria-label", open ? "Close menu" : "Open menu");
  }
  if (tog && links) {
    tog.addEventListener("click", function () { setMenu(!links.classList.contains("open")); });
    links.addEventListener("click", function (e) { if (e.target.closest("a")) setMenu(false); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && links.classList.contains("open")) { setMenu(false); tog.focus(); } });
    window.addEventListener("resize", function () { if (window.innerWidth > 860 && links.classList.contains("open")) setMenu(false); });
  }

  /* ---------- Search (local, no network) ---------- */
  var so = document.getElementById("search-overlay");
  if (so) {
    var inp = so.querySelector("input"), res = so.querySelector(".search-results"), opener;
    var pages = [
      { title: "Games", url: "games.html", text: "games catalog all games" },
      { title: "About SDX PLAYS", url: "about.html", text: "about studio team independent game development" },
      { title: "Contact", url: "contact.html", text: "contact email social support" }
    ];
    var items = GAMES.map(function (g) {
      return { title: str(g.title), url: gamePage(g), img: safePath(g.cover), text: (str(g.title) + " " + str(g.short) + " " + (Array.isArray(g.tags) ? g.tags.join(" ") : "")).toLowerCase() };
    }).concat(pages);
    function render(q) {
      q = q.trim().toLowerCase().slice(0, 80);
      while (res.firstChild) res.removeChild(res.firstChild);
      var hits = q ? items.filter(function (it) { return (it.title + " " + it.text).toLowerCase().indexOf(q) > -1; }) : items.slice(0, GAMES.length);
      if (!hits.length) { res.appendChild(el("li", { class: "none", text: "No results for “" + q + "”." })); return; }
      hits.forEach(function (h) {
        res.appendChild(el("li", {}, [el("a", { href: h.url }, [h.img ? el("img", { src: h.img, alt: "" }) : null, el("strong", { text: h.title })])]));
      });
    }
    function openS() { opener = document.activeElement; so.classList.add("open"); inp.value = ""; render(""); inp.focus(); }
    function closeS() { so.classList.remove("open"); if (opener) opener.focus(); }
    document.querySelectorAll("[data-open-search]").forEach(function (b) { b.addEventListener("click", openS); });
    so.querySelector(".close").addEventListener("click", closeS);
    so.addEventListener("click", function (e) { if (e.target === so) closeS(); });
    inp.addEventListener("input", function () { render(inp.value); });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") { if (so.classList.contains("open")) closeS(); if (lb && lb.classList.contains("open")) closeLightbox(); }
      if (lb && lb.classList.contains("open")) { if (e.key === "ArrowRight") showLb(lbIdx + 1); if (e.key === "ArrowLeft") showLb(lbIdx - 1); }
      if (e.key === "/" && !/input|textarea/i.test(document.activeElement.tagName)) { e.preventDefault(); openS(); }
    });
  }

  /* ---------- Hero slider (pauses when hidden / reduced motion) ---------- */
  var hero = document.querySelector("[data-slider]");
  if (hero) {
    var slides = hero.querySelectorAll(".hero-slide"), dots = hero.querySelector(".hero-dots"), cur = 0, timer;
    var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    function go(i) {
      slides[cur].classList.remove("is-active"); slides[cur].setAttribute("aria-hidden", "true");
      cur = (i + slides.length) % slides.length;
      slides[cur].classList.add("is-active"); slides[cur].removeAttribute("aria-hidden");
      if (dots) dots.querySelectorAll("button").forEach(function (d, k) { d.setAttribute("aria-current", k === cur ? "true" : "false"); });
    }
    function stop() { clearInterval(timer); timer = null; }
    function auto() { stop(); if (!reduce && !document.hidden) timer = setInterval(function () { go(cur + 1); }, 8000); }
    if (slides.length > 1 && dots) {
      slides.forEach(function (_, k) {
        var d = el("button", { type: "button", "aria-label": "Show slide " + (k + 1) });
        d.addEventListener("click", function () { go(k); auto(); });
        dots.appendChild(d);
      });
      go(0); auto();
      hero.addEventListener("mouseenter", stop);
      hero.addEventListener("mouseleave", auto);
      hero.addEventListener("focusin", stop);
      document.addEventListener("visibilitychange", function () { document.hidden ? stop() : auto(); });
    }
  }

  /* ---------- Back to top ---------- */
  var tt = document.querySelector(".to-top"), ticking = false;
  if (tt) window.addEventListener("scroll", function () {
    if (ticking) return; ticking = true;
    requestAnimationFrame(function () { tt.classList.toggle("show", window.scrollY > 600); ticking = false; });
  }, { passive: true });
  document.querySelectorAll(".to-top, .js-top").forEach(function (b) { b.addEventListener("click", function () { window.scrollTo({ top: 0 }); }); });
  var y = document.getElementById("year"); if (y) y.textContent = String(new Date().getFullYear());
})();
