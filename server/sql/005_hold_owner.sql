-- ============================================================== hold ownership ==
--
-- A checkout hold had no owner. `slot_holds` recorded the court and the time but not who
-- was holding it, so nothing could tell one player's hold from another's — and two
-- endpoints took a hold id and acted on it with no check: releasing one, and redeeming one
-- into a booking.
--
-- Hold ids are random UUIDs and are only ever returned to the player who took the hold, so
-- this was not trivially reachable. It was still a missing check on the one path that takes
-- money, and "hard to guess" is not an authorisation model.

-- Holds live five minutes. Clearing them costs a player at most a re-tap, and it is far
-- simpler than inventing an owner for rows that never had one.
DELETE FROM slot_holds;

ALTER TABLE slot_holds ADD COLUMN IF NOT EXISTS user_id TEXT NOT NULL REFERENCES players (id);

-- "My holds" is not a query anyone makes; the lookups are all by id or by court and time.
-- The column exists to be compared against the caller, not to be searched.
