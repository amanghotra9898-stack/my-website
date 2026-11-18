-- SDX PLAYS admin login tables (D1). Run once on the Preview database.
-- Separate from analytics: these statements never read or change the `events` table.

CREATE TABLE IF NOT EXISTS admin_sessions (
  token_hash  TEXT PRIMARY KEY,      -- SHA-256 of the random session token (the token itself is only in the cookie)
  created_at  INTEGER NOT NULL,
  last_seen   INTEGER NOT NULL,      -- idle timeout: 30 min
  expires_at  INTEGER NOT NULL,      -- absolute timeout: 8 h
  cred_fp     TEXT NOT NULL,         -- fingerprint of password hash + TOTP secret; a change revokes the session
  ua_hash     TEXT NOT NULL          -- supplementary signal only, not a security boundary
);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_expires ON admin_sessions (expires_at);

CREATE TABLE IF NOT EXISTS admin_login_attempts (
  id   INTEGER PRIMARY KEY AUTOINCREMENT,
  ts   INTEGER NOT NULL,
  src  TEXT NOT NULL                 -- keyed hash of the network address (raw IPs are not stored)
);
CREATE INDEX IF NOT EXISTS idx_admin_attempts_src_ts ON admin_login_attempts (src, ts);
CREATE INDEX IF NOT EXISTS idx_admin_attempts_ts ON admin_login_attempts (ts);

CREATE TABLE IF NOT EXISTS admin_totp_used (
  step     INTEGER PRIMARY KEY,      -- 30-second TOTP time step that was accepted
  used_at  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS admin_recovery_used (
  code_hash  TEXT PRIMARY KEY,       -- HMAC of the recovery code; the code itself is never stored
  used_at    INTEGER NOT NULL
);
