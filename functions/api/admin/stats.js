// GET /api/admin/stats?days=30 — aggregated analytics for the private dashboard.
// Protected by ./_middleware.js (admin session cookie).

import { json, istDay, istDayOffset } from "../../_lib/util.js";

const RELEASE_API = "https://api.github.com/repos/amanghotra9898-stack/my-website/releases";

async function githubAssetRequests() {
  // Public GitHub data (no token): how many times the release file was requested.
  try {
    const res = await fetch(RELEASE_API, {
      headers: { "User-Agent": "sdx-plays-analytics", Accept: "application/vnd.github+json" },
      cf: { cacheTtl: 900 },
    });
    if (!res.ok) return null;
    const releases = await res.json();
    let total = 0;
    for (const r of releases) for (const a of r.assets || []) if (/\.apk$/i.test(a.name)) total += a.download_count || 0;
    return total;
  } catch { return null; }
}

export async function onRequestGet({ request, env, data }) {
  if (!env.DB) return json({ error: "database not configured" }, 503);
  const db = env.DB;
  const url = new URL(request.url);
  const days = [7, 30, 90].includes(Number(url.searchParams.get("days"))) ? Number(url.searchParams.get("days")) : 30;

  const today = istDay();
  const d7 = istDayOffset(6), d30 = istDayOffset(29), from = istDayOffset(days - 1);

  // Totals for a window: page views, visitors (sum of daily unique visitors), clicks, unique clickers.
  const windowSql = `
    SELECT
      SUM(CASE WHEN type='pageview' THEN 1 ELSE 0 END) AS pageviews,
      SUM(CASE WHEN type='download_click' THEN 1 ELSE 0 END) AS clicks
    FROM events WHERE day >= ?1`;
  const visitorsSql = `
    SELECT COUNT(*) AS n FROM (SELECT DISTINCT day, visitor FROM events WHERE day >= ?1)`;
  const clickersSql = `
    SELECT COUNT(*) AS n FROM (SELECT DISTINCT day, visitor FROM events WHERE type='download_click' AND day >= ?1)`;

  const windows = { all: "0000-00-00", today, last7: d7, last30: d30 };
  const stmts = [];
  for (const start of Object.values(windows)) {
    stmts.push(db.prepare(windowSql).bind(start), db.prepare(visitorsSql).bind(start), db.prepare(clickersSql).bind(start));
  }
  stmts.push(
    db.prepare(`SELECT day,
        SUM(CASE WHEN type='pageview' THEN 1 ELSE 0 END) AS pageviews,
        SUM(CASE WHEN type='download_click' THEN 1 ELSE 0 END) AS clicks,
        COUNT(DISTINCT visitor) AS visitors
      FROM events WHERE day >= ?1 GROUP BY day ORDER BY day`).bind(from),
    db.prepare(`SELECT button, COUNT(*) AS n FROM events WHERE type='download_click' AND day >= ?1 GROUP BY button ORDER BY n DESC`).bind(from),
    db.prepare(`SELECT path, COUNT(*) AS n FROM events WHERE type='pageview' AND day >= ?1 GROUP BY path ORDER BY n DESC LIMIT 10`).bind(from),
    db.prepare(`SELECT device, COUNT(DISTINCT day || visitor) AS n FROM events WHERE day >= ?1 GROUP BY device ORDER BY n DESC`).bind(from),
    db.prepare(`SELECT country, COUNT(DISTINCT day || visitor) AS n FROM events WHERE day >= ?1 AND country IS NOT NULL GROUP BY country ORDER BY n DESC LIMIT 8`).bind(from),
    db.prepare(`SELECT referrer, COUNT(*) AS n FROM events WHERE type='pageview' AND day >= ?1 AND referrer IS NOT NULL GROUP BY referrer ORDER BY n DESC LIMIT 8`).bind(from),
    db.prepare(`SELECT ts, button, path, device, country FROM events WHERE type='download_click' ORDER BY ts DESC LIMIT 50`)
  );

  const [results, ghRequests] = await Promise.all([db.batch(stmts), githubAssetRequests()]);
  const rows = results.map((r) => r.results || []);

  const summary = {};
  Object.keys(windows).forEach((name, i) => {
    const w = rows[i * 3][0] || {};
    summary[name] = {
      pageviews: w.pageviews || 0,
      clicks: w.clicks || 0,
      visitors: (rows[i * 3 + 1][0] || {}).n || 0,
      clickers: (rows[i * 3 + 2][0] || {}).n || 0,
    };
  });
  const base = Object.keys(windows).length * 3;

  // Fill missing days with zeros so the chart has a continuous axis.
  const byDay = Object.fromEntries(rows[base].map((r) => [r.day, r]));
  const series = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = istDayOffset(i);
    const r = byDay[d] || {};
    series.push({ day: d, pageviews: r.pageviews || 0, visitors: r.visitors || 0, clicks: r.clicks || 0 });
  }

  return json({
    generatedAt: new Date().toISOString(),
    timezone: "Asia/Kolkata",
    admin: data.adminUser,
    days,
    summary,
    series,
    buttons: rows[base + 1],
    pages: rows[base + 2],
    devices: rows[base + 3],
    countries: rows[base + 4],
    referrers: rows[base + 5],
    recentClicks: rows[base + 6],
    githubApkRequests: ghRequests,
  });
}
