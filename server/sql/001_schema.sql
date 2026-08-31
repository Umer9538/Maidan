-- MAIDAN schema.
--
-- Mirrors docs/05-technical-architecture.md §4. Two things here are load-bearing and the
-- rest is ordinary bookkeeping:
--
--   1. `bookings_no_overlap` makes double-booking impossible by construction, not by
--      application logic. Two requests racing for the same court and hour cannot both
--      commit, whatever the server does.
--   2. `bookings.intent_id` is unique, so a client that retries a dropped request gets the
--      original booking back instead of a second one and a second charge.

CREATE EXTENSION IF NOT EXISTS btree_gist;

-- ---------------------------------------------------------------------------- players --

CREATE TABLE IF NOT EXISTS players (
  id            TEXT PRIMARY KEY,
  full_name     TEXT NOT NULL,
  email         TEXT UNIQUE,
  phone         TEXT,
  avatar_url    TEXT,
  -- Derived from attendance; stored so it can be read without recomputing every time.
  reliability   INTEGER NOT NULL DEFAULT 100 CHECK (reliability BETWEEN 0 AND 100),
  games_played  INTEGER NOT NULL DEFAULT 0,
  skill_by_sport JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------- venues --

CREATE TABLE IF NOT EXISTS venues (
  id                  TEXT PRIMARY KEY,
  owner_id            TEXT NOT NULL REFERENCES players (id),
  name                TEXT NOT NULL,
  city                TEXT NOT NULL,
  area                TEXT NOT NULL,
  latitude            DOUBLE PRECISION NOT NULL,
  longitude           DOUBLE PRECISION NOT NULL,
  sports              TEXT[] NOT NULL DEFAULT '{}',
  amenities           TEXT[] NOT NULL DEFAULT '{}',
  photos              TEXT[] NOT NULL DEFAULT '{}',
  about               TEXT NOT NULL DEFAULT '',
  opens_at            TEXT NOT NULL,
  closes_at           TEXT NOT NULL,
  from_price_per_hour INTEGER NOT NULL,
  phone               TEXT NOT NULL DEFAULT '',
  rating              NUMERIC(2,1),
  review_count        INTEGER NOT NULL DEFAULT 0,
  player_count        INTEGER NOT NULL DEFAULT 0,
  status              TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'verified', 'live')),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS venues_city_status_idx ON venues (city, status);

-- ----------------------------------------------------------------------------- courts --

CREATE TABLE IF NOT EXISTS courts (
  id                   TEXT PRIMARY KEY,
  venue_id             TEXT NOT NULL REFERENCES venues (id) ON DELETE CASCADE,
  name                 TEXT NOT NULL,
  sport                TEXT NOT NULL,
  format               TEXT NOT NULL,
  surface              TEXT NOT NULL DEFAULT '',
  indoor               BOOLEAN NOT NULL DEFAULT false,
  base_price_per_hour  INTEGER NOT NULL,
  -- Peak windows may wrap past midnight; the server reads them, not the database.
  peak_rules           JSONB NOT NULL DEFAULT '[]'::jsonb
);

CREATE INDEX IF NOT EXISTS courts_venue_idx ON courts (venue_id);

-- ------------------------------------------------------------------- cancellation ----

CREATE TABLE IF NOT EXISTS cancellation_policies (
  id    TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  tiers JSONB NOT NULL
);

-- --------------------------------------------------------------------------- bookings --

CREATE TABLE IF NOT EXISTS bookings (
  id             TEXT PRIMARY KEY,
  -- Client-generated. Unique, so a retry cannot create a second booking.
  intent_id      TEXT NOT NULL UNIQUE,
  court_id       TEXT NOT NULL REFERENCES courts (id),
  venue_id       TEXT NOT NULL REFERENCES venues (id),
  user_id        TEXT NOT NULL REFERENCES players (id),
  team_id        TEXT,
  start_at       TIMESTAMPTZ NOT NULL,
  end_at         TIMESTAMPTZ NOT NULL,
  status         TEXT NOT NULL
                   CHECK (status IN ('pending','confirmed','checked_in','completed','cancelled','no_show')),
  total          INTEGER NOT NULL,
  paid_online    INTEGER NOT NULL DEFAULT 0,
  due_at_venue   INTEGER NOT NULL DEFAULT 0,
  payment_mode   TEXT NOT NULL CHECK (payment_mode IN ('full_prepay','deposit')),
  provider       TEXT,
  source         TEXT NOT NULL DEFAULT 'app' CHECK (source IN ('app','manual')),
  -- Snapshotted at creation: a later policy change must not alter an existing booking.
  cancellation_policy JSONB NOT NULL,
  code           TEXT NOT NULL,
  customer_name  TEXT,
  customer_phone TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),

  CHECK (end_at > start_at)
);

-- The referee. A cancelled booking releases its slot, so it is excluded from the
-- constraint; everything else on one court must occupy a distinct hour.
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_no_overlap;
ALTER TABLE bookings ADD CONSTRAINT bookings_no_overlap
  EXCLUDE USING gist (
    court_id WITH =,
    tstzrange(start_at, end_at) WITH &&
  ) WHERE (status <> 'cancelled');

CREATE INDEX IF NOT EXISTS bookings_venue_start_idx ON bookings (venue_id, start_at);
CREATE INDEX IF NOT EXISTS bookings_user_idx ON bookings (user_id, start_at DESC);

-- ------------------------------------------------------------------------ slot holds --

-- The five-minute checkout hold. Redis in production (docs/05 §5.1); a table here, which
-- behaves identically and keeps the stack to one dependency for local testing.
CREATE TABLE IF NOT EXISTS slot_holds (
  id         TEXT PRIMARY KEY,
  court_id   TEXT NOT NULL REFERENCES courts (id) ON DELETE CASCADE,
  start_at   TIMESTAMPTZ NOT NULL,
  end_at     TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One live hold per court-hour. Expired rows are swept before each hold attempt, so this
-- only ever collides with a hold that is genuinely still running.
CREATE UNIQUE INDEX IF NOT EXISTS slot_holds_unique_live ON slot_holds (court_id, start_at);
CREATE INDEX IF NOT EXISTS slot_holds_expiry_idx ON slot_holds (expires_at);

-- ------------------------------------------------------------------------- matchmaking --

CREATE TABLE IF NOT EXISTS open_matches (
  id                TEXT PRIMARY KEY,
  booking_id        TEXT NOT NULL UNIQUE REFERENCES bookings (id) ON DELETE CASCADE,
  host_id           TEXT NOT NULL REFERENCES players (id),
  venue_id          TEXT NOT NULL REFERENCES venues (id),
  court_id          TEXT NOT NULL REFERENCES courts (id),
  sport             TEXT NOT NULL,
  format            TEXT NOT NULL,
  start_at          TIMESTAMPTZ NOT NULL,
  players_needed    INTEGER NOT NULL CHECK (players_needed > 1),
  players_joined    INTEGER NOT NULL DEFAULT 1,
  skill_level       TEXT NOT NULL,
  gender_preference TEXT NOT NULL DEFAULT 'anyone',
  price_per_player  INTEGER NOT NULL,
  note              TEXT,
  instant_join      BOOLEAN NOT NULL DEFAULT true,
  status            TEXT NOT NULL DEFAULT 'open'
                      CHECK (status IN ('open','full','cancelled','played')),

  CHECK (players_joined <= players_needed)
);

CREATE TABLE IF NOT EXISTS match_players (
  match_id TEXT NOT NULL REFERENCES open_matches (id) ON DELETE CASCADE,
  user_id  TEXT NOT NULL REFERENCES players (id),
  status   TEXT NOT NULL DEFAULT 'requested'
             CHECK (status IN ('requested','approved','paid','attended','no_show')),
  PRIMARY KEY (match_id, user_id)
);

-- ------------------------------------------------------------------------------ teams --

CREATE TABLE IF NOT EXISTS teams (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  sport      TEXT NOT NULL,
  city       TEXT NOT NULL,
  crest_url  TEXT,
  captain_id TEXT NOT NULL REFERENCES players (id),
  wins       INTEGER NOT NULL DEFAULT 0,
  losses     INTEGER NOT NULL DEFAULT 0,
  city_rank  INTEGER
);

CREATE TABLE IF NOT EXISTS team_members (
  team_id TEXT NOT NULL REFERENCES teams (id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES players (id),
  PRIMARY KEY (team_id, user_id)
);

CREATE TABLE IF NOT EXISTS challenges (
  id                 TEXT PRIMARY KEY,
  type               TEXT NOT NULL CHECK (type IN ('open','direct')),
  challenger_team_id TEXT NOT NULL REFERENCES teams (id),
  opponent_team_id   TEXT REFERENCES teams (id),
  sport              TEXT NOT NULL,
  format             TEXT NOT NULL,
  area               TEXT NOT NULL,
  proposed_start_at  TIMESTAMPTZ NOT NULL,
  stake              TEXT NOT NULL CHECK (stake IN ('split_cost','loser_pays')),
  status             TEXT NOT NULL DEFAULT 'open'
                       CHECK (status IN ('open','accepted','booked','played','cancelled')),
  agreed_booking_id  TEXT REFERENCES bookings (id),
  -- One row per reporting captain, so a disagreement keeps both claims on record.
  reported_scores    JSONB NOT NULL DEFAULT '{}'::jsonb,

  CHECK (opponent_team_id IS NULL OR opponent_team_id <> challenger_team_id)
);

-- ------------------------------------------------------------------------------- chat --

CREATE TABLE IF NOT EXISTS chat_threads (
  id              TEXT PRIMARY KEY,
  kind            TEXT NOT NULL CHECK (kind IN ('match','team','venue')),
  title           TEXT NOT NULL,
  subtitle        TEXT,
  avatar_url      TEXT,
  venue_id        TEXT REFERENCES venues (id),
  last_message    TEXT NOT NULL DEFAULT '',
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS thread_members (
  thread_id TEXT NOT NULL REFERENCES chat_threads (id) ON DELETE CASCADE,
  user_id   TEXT NOT NULL REFERENCES players (id),
  unread    INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (thread_id, user_id)
);

CREATE TABLE IF NOT EXISTS messages (
  id        TEXT PRIMARY KEY,
  thread_id TEXT NOT NULL REFERENCES chat_threads (id) ON DELETE CASCADE,
  author_id TEXT NOT NULL REFERENCES players (id),
  body      TEXT NOT NULL,
  sent_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS messages_thread_idx ON messages (thread_id, sent_at);

-- ---------------------------------------------------------------------------- reviews --

CREATE TABLE IF NOT EXISTS reviews (
  id         TEXT PRIMARY KEY,
  venue_id   TEXT NOT NULL REFERENCES venues (id) ON DELETE CASCADE,
  -- One review per booking: this is what makes a review verified rather than anonymous.
  booking_id TEXT NOT NULL UNIQUE,
  author_id  TEXT NOT NULL REFERENCES players (id),
  rating     INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  body       TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS reviews_venue_idx ON reviews (venue_id, created_at DESC);

-- ---------------------------------------------------------------------- notifications --

CREATE TABLE IF NOT EXISTS notifications (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES players (id),
  kind         TEXT NOT NULL,
  actor_name   TEXT NOT NULL,
  actor_avatar TEXT,
  body         TEXT NOT NULL,
  target_id    TEXT,
  read         BOOLEAN NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------------- payment events --

-- Every gateway webhook lands here raw before anything acts on it, so the ledger can be
-- replayed and reconciled (docs/05 §5.2).
CREATE TABLE IF NOT EXISTS payment_events (
  id           TEXT PRIMARY KEY,
  booking_id   TEXT REFERENCES bookings (id),
  provider     TEXT NOT NULL,
  provider_ref TEXT,
  payload      JSONB NOT NULL,
  processed_at TIMESTAMPTZ,
  received_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
