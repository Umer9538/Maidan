-- ============================================================================= auth ==
--
-- Until now the caller's identity arrived in an `x-user-id` header and was believed. That
-- made every endpoint effectively public: anyone could cancel someone else's booking, read
-- their conversations, or act as a venue owner by editing one request header.
--
-- Three tables replace it. Nothing here stores a secret in a form we could read back: the
-- password, the refresh token and the OTP are all held as hashes, so a dump of this
-- database does not hand over anyone's account.

-- An empty string is not an address and not a number, but it is a value, so it collides
-- with every other blank under a unique index. Absent means NULL from here on.
UPDATE players SET email = NULL WHERE email = '';
UPDATE players SET phone = NULL WHERE phone = '';

-- Email is the login handle, and `Umer@…` and `umer@…` are the same person. `players.email`
-- already carries a UNIQUE constraint, but that one is case-sensitive and would happily
-- accept both.
CREATE UNIQUE INDEX IF NOT EXISTS players_email_lower_key
  ON players (lower(email))
  WHERE email IS NOT NULL;

-- Phone is the other handle: OTP sign-in looks a player up by it, and two accounts on one
-- number would make that lookup ambiguous.
CREATE UNIQUE INDEX IF NOT EXISTS players_phone_key
  ON players (phone)
  WHERE phone IS NOT NULL;

-- ---------------------------------------------------------------------- credentials --
--
-- Keyed on the player rather than carrying its own email column. Two copies of an address
-- is two places to change it and one chance to forget, so the address stays on `players`
-- and this table holds only the secret.
CREATE TABLE IF NOT EXISTS credentials (
  player_id     TEXT PRIMARY KEY REFERENCES players (id) ON DELETE CASCADE,
  -- scrypt, as `N$r$p$salt$hash`. Never the password, and never a plain digest of it.
  password_hash TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------------- refresh tokens --
--
-- Access tokens are short-lived and signed, so they cannot be withdrawn once issued. This
-- table is what makes sign-out mean something: the long-lived half lives here, and
-- revoking the row ends the session at the next refresh.
--
-- Stored as a SHA-256 hash. The token is high-entropy random, so a fast digest is right —
-- there is nothing to brute-force the way there is with a password.
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id         TEXT PRIMARY KEY,
  player_id  TEXT NOT NULL REFERENCES players (id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  -- Set when a token is exchanged, pointing at what replaced it. A refresh token presented
  -- twice means it leaked, and the chain is what lets us see that and drop the whole family.
  replaced_by TEXT REFERENCES refresh_tokens (id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS refresh_tokens_player_live_idx
  ON refresh_tokens (player_id)
  WHERE revoked_at IS NULL;

-- ------------------------------------------------------------------------ otp codes --
--
-- Phone sign-in for a market where email is the second address, not the first.
--
-- `attempts` is on the row rather than counted from a log because the limit has to hold
-- across processes: six guesses at a six-digit code is the whole security of this flow.
CREATE TABLE IF NOT EXISTS otp_codes (
  id          TEXT PRIMARY KEY,
  phone       TEXT NOT NULL,
  code_hash   TEXT NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  attempts    INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Verification reads the newest unconsumed code for a number; sending one rate-limits on
-- how many went out recently. Both are this index.
CREATE INDEX IF NOT EXISTS otp_codes_phone_recent_idx
  ON otp_codes (phone, created_at DESC);
