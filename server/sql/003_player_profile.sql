-- ================================================================== player profile ==
--
-- Sports and city were chosen during setup and kept only on the phone. That made them a
-- property of the device rather than of the account: signing in on a new handset produced
-- a session with no sports and no city, which the app reads as "setup not finished" — so a
-- player who had been using MAIDAN for months was walked back through the intro.
--
-- They belong on the account. The app still holds a copy for offline reads, but the server
-- is the authority.

ALTER TABLE players ADD COLUMN IF NOT EXISTS sports TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE players ADD COLUMN IF NOT EXISTS city TEXT;

-- Setup is finished when both are present, and that is the same question the app's auth
-- gate asks. Keeping the rule in one place stops the two drifting.
COMMENT ON COLUMN players.sports IS
  'Sports the player picked during setup. Empty means setup is unfinished.';

-- Existing accounts predate the columns and have neither, so they would all read as
-- unfinished. Everyone seeded so far plays in Lahore.
UPDATE players
   SET sports = ARRAY['padel', 'futsal', 'cricket'], city = 'lahore'
 WHERE cardinality(sports) = 0 AND city IS NULL;
