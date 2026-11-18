-- SDX PLAYS analytics — Cloudflare D1 schema
-- Run once in the Cloudflare dashboard: D1 → sdx-analytics → Console (paste this file).
-- Privacy: no cookies, no raw IP addresses. `visitor` is a salted one-way hash of
-- (IP + browser + date) that changes every day, so it cannot follow a person across days.

CREATE TABLE IF NOT EXISTS events (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  eid       TEXT,                             -- random one-time event id (makes browser retries harmless)
  ts        INTEGER NOT NULL,                 -- Unix time in milliseconds (UTC)
  day       TEXT    NOT NULL,                 -- YYYY-MM-DD in India time (Asia/Kolkata)
  type      TEXT    NOT NULL CHECK (type IN ('pageview', 'download_click')),
  path      TEXT    NOT NULL,                 -- page the event happened on
  game      TEXT,                             -- e.g. 'medieval-life' (download clicks only)
  button    TEXT,                             -- which download button was clicked
  visitor   TEXT    NOT NULL,                 -- daily-rotating salted hash of IP+browser (32 hex chars)
  src       TEXT    NOT NULL,                 -- daily-rotating salted hash of IP only (rate limiting)
  device    TEXT,                             -- mobile | tablet | desktop
  country   TEXT,                             -- 2-letter code from Cloudflare
  referrer  TEXT                              -- external referring host only
);

CREATE INDEX IF NOT EXISTS idx_events_type_day ON events (type, day);
CREATE INDEX IF NOT EXISTS idx_events_visitor  ON events (visitor, ts);
CREATE INDEX IF NOT EXISTS idx_events_src      ON events (src, ts);
CREATE UNIQUE INDEX IF NOT EXISTS idx_events_eid ON events (eid);
