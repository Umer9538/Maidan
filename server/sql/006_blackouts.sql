-- ================================================================== blackouts ==
--
-- A ground closes for Eid, resurfaces a pitch, or hosts a tournament that takes the whole
-- place for a weekend. Until now the only way to stop those hours selling was to unpublish
-- the entire venue, which also hid it from search and stopped every other court.
--
-- A blackout is a window that cannot be booked. It covers one court when `court_id` is set
-- and the whole ground when it is null — resurfacing is one pitch, Eid is the building.

CREATE TABLE IF NOT EXISTS blackouts (
  id         TEXT PRIMARY KEY,
  venue_id   TEXT NOT NULL REFERENCES venues (id) ON DELETE CASCADE,
  -- Null means every court at this venue.
  court_id   TEXT REFERENCES courts (id) ON DELETE CASCADE,
  starts_at  TIMESTAMPTZ NOT NULL,
  ends_at    TIMESTAMPTZ NOT NULL,
  -- Shown to the owner on their own calendar, never to players: a player only needs to know
  -- the hour is not available, not that a pitch is being relaid.
  reason     TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT blackouts_window CHECK (ends_at > starts_at)
);

-- Every read is "does anything cover this court at this time", so the index is the range.
CREATE INDEX IF NOT EXISTS blackouts_venue_window_idx
  ON blackouts USING gist (venue_id, tstzrange(starts_at, ends_at));

CREATE INDEX IF NOT EXISTS blackouts_court_idx ON blackouts (court_id) WHERE court_id IS NOT NULL;
