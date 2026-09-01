-- ================================================================ venue approval ==
--
-- A ground owner signs up, describes their venue and its courts, and waits. Nothing they
-- have listed can be booked by anyone — including themselves at the counter — until a
-- human at MAIDAN has looked at it and approved it.
--
-- Hiding an unapproved venue from search was never enough on its own: its courts were
-- still reachable by id, so slots could be read and bookings taken against a ground nobody
-- had verified existed. The status is now checked on the booking path, not just in
-- discovery.

-- --------------------------------------------------------------------------- admins --
--
-- A flag rather than a roles table. There is one privilege — approving venues — and a
-- table with one row per person and one meaningful value in it would be a join for nothing.
-- It becomes a table on the day a second privilege exists.
ALTER TABLE players ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false;

-- --------------------------------------------------------------------- review trail --

ALTER TABLE venues ADD COLUMN IF NOT EXISTS review_note TEXT;
ALTER TABLE venues ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;
ALTER TABLE venues ADD COLUMN IF NOT EXISTS reviewed_by TEXT REFERENCES players (id);

/*
 * `rejected` joins the lifecycle:
 *
 *   pending   submitted, waiting on a human
 *   rejected  turned down, with a note saying why so it can be fixed and resubmitted
 *   verified  approved — the owner may publish once there is a court to book
 *   live      visible in search and bookable
 *
 * `verified` and `live` are deliberately separate. Approval says the ground is real;
 * publishing says the owner is ready. A venue approved on Monday with no courts entered yet
 * would otherwise appear in search as a ground with nothing to book.
 */
ALTER TABLE venues DROP CONSTRAINT IF EXISTS venues_status_check;
ALTER TABLE venues ADD CONSTRAINT venues_status_check
  CHECK (status IN ('pending', 'rejected', 'verified', 'live'));

-- The review queue is read by status, oldest first — the only query an admin makes often.
CREATE INDEX IF NOT EXISTS venues_status_created_idx ON venues (status, created_at);
