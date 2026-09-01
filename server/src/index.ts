/**
 * MAIDAN API.
 *
 * A modular monolith, as docs/05 §3 prescribes — one process, clean seams, no
 * microservices for a launch. Endpoints mirror the client's `MaidanApi` one for one, so
 * swapping the mock for HTTP is a transport change and nothing else.
 *
 * Authentication is a bearer token, verified in `requireAuth` before any route runs, and
 * every path not in that module's `PUBLIC` list needs one. Protection is therefore the
 * default: a new endpoint added below is behind sign-in without anyone remembering to say
 * so, which is the only arrangement where forgetting fails closed.
 *
 * Authorisation is separate and per-row. Knowing who is calling is not the same as knowing
 * what is theirs, so handlers that touch a specific record assert against the record
 * itself — see `authorize.ts`.
 */
import cors from 'cors';
import express, { type NextFunction, type Request, type Response } from 'express';

import { perPlayerShare } from '@/lib/money';
import { toPkt } from '@/lib/datetime';

import {
  login,
  logout,
  refresh,
  register,
  requestOtp,
  verifyOtp,
} from './auth-service.js';
import {
  assertCanSeeBooking,
  assertCaptain,
  assertOwnsBooking,
  assertOwnsVenue,
  assertThreadMember,
  currentUser,
  requireAuth,
} from './authorize.js';
import {
  createBooking,
  createManualBooking,
  holdSlot,
  listSlots,
  releaseHold,
} from './booking-service.js';
import { pool } from './db.js';
import { ApiError } from './errors.js';
import {
  toBooking,
  toChallenge,
  toCourt,
  toCurrentPlayer,
  toMessage,
  toNotification,
  toOpenMatch,
  toPlayer,
  toReview,
  toTeam,
  toThread,
  toVenue,
} from './mappers.js';

const app = express();
app.use(cors());
app.use(express.json());

/** One line per request. Enough to see what the app is doing without a logging stack. */
app.use((req, res, next) => {
  const started = Date.now();
  res.on('finish', () => {
    console.log(
      `${res.statusCode} ${req.method} ${req.originalUrl} ${Date.now() - started}ms`,
    );
  });
  next();
});

/*
 * Mounted here, ahead of every route below, so protection is structural rather than
 * remembered. Anything added after this line is behind a token unless `authorize.ts`
 * names it public.
 */
app.use(requireAuth);

/** Wraps an async handler so a rejection reaches the error middleware. */
function route(handler: (req: Request, res: Response) => Promise<unknown>) {
  return (req: Request, res: Response, next: NextFunction) => {
    handler(req, res).catch(next);
  };
}

function required(value: unknown, name: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new ApiError('validation', `${name} is required`);
  }
  return value;
}

// ------------------------------------------------------------------------------ health --

// -------------------------------------------------------------------------------- auth --

app.post('/auth/register', route(async (req, res) => {
  const session = await register({
    fullName: required(req.body?.fullName, 'fullName'),
    email: required(req.body?.email, 'email'),
    phone: required(req.body?.phone, 'phone'),
    password: required(req.body?.password, 'password'),
  });
  res.status(201).json(session);
}));

app.post('/auth/login', route(async (req, res) => {
  const session = await login(
    required(req.body?.email, 'email'),
    required(req.body?.password, 'password'),
  );
  res.json(session);
}));

app.post('/auth/otp', route(async (req, res) => {
  res.json(await requestOtp(required(req.body?.phone, 'phone')));
}));

app.post('/auth/otp/verify', route(async (req, res) => {
  const session = await verifyOtp(
    required(req.body?.phone, 'phone'),
    required(req.body?.code, 'code'),
    typeof req.body?.fullName === 'string' ? req.body.fullName : undefined,
  );
  res.json(session);
}));

app.post('/auth/refresh', route(async (req, res) => {
  res.json(await refresh(required(req.body?.refreshToken, 'refreshToken')));
}));

app.post('/auth/logout', route(async (req, res) => {
  await logout(required(req.body?.refreshToken, 'refreshToken'));
  res.status(204).end();
}));

// ------------------------------------------------------------------------------ health --

app.get('/health', route(async (_req, res) => {
  await pool.query('SELECT 1');
  res.json({ ok: true });
}));

// ------------------------------------------------------------------------------ venues --

app.get('/venues', route(async (req, res) => {
  const { sport, query, maxPricePerHour } = req.query;
  const conditions = ["status = 'live'"];
  const params: unknown[] = [];

  if (typeof sport === 'string') {
    params.push(sport);
    conditions.push(`$${params.length} = ANY (sports)`);
  }
  if (typeof query === 'string' && query.trim()) {
    params.push(`%${query.trim()}%`);
    conditions.push(`(name ILIKE $${params.length} OR area ILIKE $${params.length})`);
  }
  if (typeof maxPricePerHour === 'string') {
    params.push(Number(maxPricePerHour));
    conditions.push(`from_price_per_hour <= $${params.length}`);
  }

  const { rows } = await pool.query(
    `SELECT * FROM venues WHERE ${conditions.join(' AND ')} ORDER BY player_count DESC`,
    params,
  );
  res.json(rows.map(toVenue));
}));

app.get('/venues/:venueId', route(async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM venues WHERE id = $1', [req.params.venueId]);
  if (rows.length === 0) throw new ApiError('not_found', 'No such venue');
  res.json(toVenue(rows[0]));
}));

app.get('/venues/:venueId/courts', route(async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM courts WHERE venue_id = $1 ORDER BY name', [
    req.params.venueId,
  ]);
  res.json(rows.map(toCourt));
}));

app.get('/venues/:venueId/reviews', route(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT r.*, p.full_name AS author_name, p.avatar_url AS author_avatar_url
       FROM reviews r JOIN players p ON p.id = r.author_id
      WHERE r.venue_id = $1 ORDER BY r.created_at DESC`,
    [req.params.venueId],
  );
  res.json(rows.map(toReview));
}));

// ------------------------------------------------------------------- slots and holds --

app.get('/courts/:courtId/slots', route(async (req, res) => {
  const day = required(req.query.day, 'day');
  res.json(await listSlots(req.params.courtId, day));
}));

app.post('/holds', route(async (req, res) => {
  const courtId = required(req.body?.courtId, 'courtId');
  const startAt = required(req.body?.startAt, 'startAt');
  res.status(201).json(await holdSlot(courtId, startAt));
}));

app.delete('/holds/:holdId', route(async (req, res) => {
  await releaseHold(req.params.holdId);
  res.status(204).end();
}));

// ---------------------------------------------------------------------------- bookings --

app.post('/bookings', route(async (req, res) => {
  const booking = await createBooking({
    intentId: required(req.body?.intentId, 'intentId'),
    holdId: required(req.body?.holdId, 'holdId'),
    paymentMode: required(req.body?.paymentMode, 'paymentMode') as 'deposit' | 'full_prepay',
    provider: required(req.body?.provider, 'provider') as 'jazzcash' | 'easypaisa' | 'card',
    userId: currentUser(req),
  });
  res.status(201).json(booking);
}));

app.get('/bookings', route(async (req, res) => {
  const { rows } = await pool.query(
    'SELECT * FROM bookings WHERE user_id = $1 ORDER BY start_at DESC',
    [currentUser(req)],
  );
  res.json(rows.map(toBooking));
}));

app.get('/bookings/:bookingId', route(async (req, res) => {
  // A booking carries a name, a phone number, a code and a price. Readable by the player
  // who made it and by the owner of the ground, and by nobody else.
  await assertCanSeeBooking(req.params.bookingId, currentUser(req));

  const { rows } = await pool.query('SELECT * FROM bookings WHERE id = $1', [
    req.params.bookingId,
  ]);
  if (rows.length === 0) throw new ApiError('not_found', 'No such booking');
  res.json(toBooking(rows[0]));
}));

app.post('/bookings/:bookingId/cancel', route(async (req, res) => {
  // This one was the worst of them: any caller could cancel any booking, and the slot
  // would go back on sale under the player who had paid for it.
  await assertOwnsBooking(req.params.bookingId, currentUser(req));

  const { rows } = await pool.query(
    "UPDATE bookings SET status = 'cancelled' WHERE id = $1 RETURNING *",
    [req.params.bookingId],
  );
  if (rows.length === 0) throw new ApiError('not_found', 'No such booking');
  res.json(toBooking(rows[0]));
}));

app.post('/bookings/:bookingId/review', route(async (req, res) => {
  // A verified review means the reviewer played. Without this, anyone could post one
  // against a stranger's completed booking.
  await assertOwnsBooking(req.params.bookingId, currentUser(req));

  const { rows: bookings } = await pool.query('SELECT * FROM bookings WHERE id = $1', [
    req.params.bookingId,
  ]);
  if (bookings.length === 0) throw new ApiError('not_found', 'No such booking');
  const booking = bookings[0];

  // Only a player who actually played can review — that is what verified means.
  if (booking.status !== 'completed' && booking.status !== 'checked_in') {
    throw new ApiError('not_played', 'You can review a ground after you have played there.');
  }

  const rating = Math.min(5, Math.max(1, Math.round(Number(req.body?.rating ?? 0))));
  const body = String(req.body?.body ?? '').trim();

  try {
    const { rows } = await pool.query(
      `INSERT INTO reviews (id, venue_id, booking_id, author_id, rating, body)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [
        `review-${Date.now().toString(36)}`,
        booking.venue_id,
        booking.id,
        currentUser(req),
        rating,
        body,
      ],
    );
    const { rows: authors } = await pool.query('SELECT * FROM players WHERE id = $1', [
      currentUser(req),
    ]);
    res.status(201).json(
      toReview({
        ...rows[0],
        author_name: authors[0]?.full_name ?? 'You',
        author_avatar_url: authors[0]?.avatar_url ?? null,
      }),
    );
  } catch (error) {
    // The unique index on booking_id is what stops a second review.
    if (typeof error === 'object' && error && 'code' in error && error.code === '23505') {
      throw new ApiError('already_reviewed', 'You have already reviewed this booking.');
    }
    throw error;
  }
}));

// -------------------------------------------------------------------------- owner side --

app.get('/venues/:venueId/bookings', route(async (req, res) => {
  // A day of customer names and phone numbers. The owner's, and only the owner's.
  await assertOwnsVenue(req.params.venueId, currentUser(req));

  const day = toPkt(required(req.query.day, 'day'));
  const from = new Date(Date.UTC(day.year, day.month - 1, day.day, -5, 0, 0));
  const to = new Date(from.getTime() + 24 * 3_600_000);

  const { rows } = await pool.query(
    `SELECT * FROM bookings
      WHERE venue_id = $1 AND status <> 'cancelled' AND start_at >= $2 AND start_at < $3
      ORDER BY start_at`,
    [req.params.venueId, from.toISOString(), to.toISOString()],
  );
  res.json(rows.map(toBooking));
}));

app.post('/venues/:venueId/bookings', route(async (req, res) => {
  // Writing a booking onto someone else's court, at a price of your choosing.
  await assertOwnsVenue(req.params.venueId, currentUser(req));

  const booking = await createManualBooking({
    courtId: required(req.body?.courtId, 'courtId'),
    startAt: required(req.body?.startAt, 'startAt'),
    customerName: required(req.body?.customerName, 'customerName'),
    customerPhone: required(req.body?.customerPhone, 'customerPhone'),
    price: req.body?.price ? Number(req.body.price) : undefined,
    ownerId: currentUser(req),
  });
  res.status(201).json(booking);
}));

app.get('/venues/:venueId/earnings', route(async (req, res) => {
  // What the ground took this week. Nobody else's business.
  await assertOwnsVenue(req.params.venueId, currentUser(req));

  const dayIso = required(req.query.day, 'day');
  const day = toPkt(dayIso);
  const from = new Date(Date.UTC(day.year, day.month - 1, day.day, -5, 0, 0));
  const to = new Date(from.getTime() + 24 * 3_600_000);
  const weekFrom = new Date(from.getTime() - 6 * 24 * 3_600_000);

  const { rows } = await pool.query(
    `SELECT
       COALESCE(SUM(total) FILTER (WHERE start_at >= $2 AND start_at < $3), 0)::int AS day_total,
       COALESCE(SUM(total) FILTER (WHERE start_at >= $4 AND start_at < $3), 0)::int AS week_total,
       COALESCE(SUM(paid_online) FILTER (WHERE start_at >= $2 AND start_at < $3), 0)::int AS collected_online,
       COALESCE(SUM(due_at_venue) FILTER (WHERE start_at >= $2 AND start_at < $3), 0)::int AS due_at_venue,
       COUNT(*) FILTER (WHERE start_at >= $2 AND start_at < $3)::int AS booking_count,
       COUNT(*) FILTER (WHERE start_at >= $2 AND start_at < $3 AND source = 'manual')::int AS manual_count
     FROM bookings
     WHERE venue_id = $1 AND status <> 'cancelled'`,
    [req.params.venueId, from.toISOString(), to.toISOString(), weekFrom.toISOString()],
  );

  const row = rows[0];
  res.json({
    dayTotal: row.day_total,
    weekTotal: row.week_total,
    collectedOnline: row.collected_online,
    dueAtVenue: row.due_at_venue,
    bookingCount: row.booking_count,
    manualCount: row.manual_count,
  });
}));

// ------------------------------------------------------------------------- open matches --

const MATCH_SELECT = 'SELECT * FROM open_matches';

app.get('/matches', route(async (req, res) => {
  const conditions = ["status = 'open'"];
  const params: unknown[] = [];
  if (typeof req.query.sport === 'string') {
    params.push(req.query.sport);
    conditions.push(`sport = $${params.length}`);
  }
  if (typeof req.query.skillLevel === 'string') {
    params.push(req.query.skillLevel);
    conditions.push(`skill_level = $${params.length}`);
  }
  const { rows } = await pool.query(
    `${MATCH_SELECT} WHERE ${conditions.join(' AND ')} ORDER BY start_at`,
    params,
  );
  res.json(rows.map(toOpenMatch));
}));

app.get('/matches/mine', route(async (req, res) => {
  const { rows } = await pool.query(
    `${MATCH_SELECT} WHERE id IN (SELECT match_id FROM match_players WHERE user_id = $1)
      ORDER BY start_at`,
    [currentUser(req)],
  );
  res.json(rows.map(toOpenMatch));
}));

app.get('/matches/:matchId', route(async (req, res) => {
  const { rows } = await pool.query(`${MATCH_SELECT} WHERE id = $1`, [req.params.matchId]);
  if (rows.length === 0) throw new ApiError('not_found', 'No such match');
  res.json(toOpenMatch(rows[0]));
}));

app.post('/matches', route(async (req, res) => {
  const bookingId = required(req.body?.bookingId, 'bookingId');
  // Opening a match invites strangers to a court someone has paid for, and the host it
  // records is the person who booked it. That has to be the person asking.
  await assertOwnsBooking(bookingId, currentUser(req));

  const { rows: bookings } = await pool.query('SELECT * FROM bookings WHERE id = $1', [bookingId]);
  if (bookings.length === 0) throw new ApiError('not_found', 'No such booking');
  const booking = bookings[0];

  const { rows: courts } = await pool.query('SELECT * FROM courts WHERE id = $1', [
    booking.court_id,
  ]);
  const court = toCourt(courts[0]);

  const playersNeeded = Number(req.body?.playersNeeded ?? 0);
  const playersJoined = Number(req.body?.playersJoined ?? 1);

  try {
    const { rows } = await pool.query(
      `INSERT INTO open_matches (
         id, booking_id, host_id, venue_id, court_id, sport, format, start_at,
         players_needed, players_joined, skill_level, gender_preference,
         price_per_player, note, instant_join, status
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
       RETURNING *`,
      [
        `match-${Date.now().toString(36)}`,
        booking.id,
        booking.user_id,
        booking.venue_id,
        court.id,
        // The sport comes from the court, never from the request.
        court.sport,
        required(req.body?.format, 'format'),
        booking.start_at,
        playersNeeded,
        playersJoined,
        required(req.body?.skillLevel, 'skillLevel'),
        req.body?.genderPreference ?? 'anyone',
        // Derived from what the booking cost, so shares always cover the slot.
        perPlayerShare(booking.total, playersNeeded),
        req.body?.note ?? null,
        req.body?.instantJoin ?? true,
        playersJoined >= playersNeeded ? 'full' : 'open',
      ],
    );

    await pool.query(
      `INSERT INTO match_players (match_id, user_id, status) VALUES ($1, $2, 'approved')
       ON CONFLICT DO NOTHING`,
      [rows[0].id, booking.user_id],
    );
    res.status(201).json(toOpenMatch(rows[0]));
  } catch (error) {
    if (typeof error === 'object' && error && 'code' in error && error.code === '23505') {
      throw new ApiError('already_open', 'This booking is already open to other players.');
    }
    throw error;
  }
}));

app.post('/matches/:matchId/join', route(async (req, res) => {
  const { rows } = await pool.query(
    `UPDATE open_matches
        SET players_joined = players_joined + 1,
            status = CASE WHEN players_joined + 1 >= players_needed THEN 'full' ELSE status END
      WHERE id = $1 AND players_joined < players_needed
      RETURNING *`,
    [req.params.matchId],
  );
  if (rows.length === 0) throw new ApiError('slot_taken', 'This match just filled up.');

  await pool.query(
    `INSERT INTO match_players (match_id, user_id, status) VALUES ($1, $2, 'approved')
     ON CONFLICT DO NOTHING`,
    [req.params.matchId, currentUser(req)],
  );
  res.json(toOpenMatch(rows[0]));
}));

// ----------------------------------------------------------------- teams and challenges --

const TEAM_SELECT = `
  SELECT t.*, COALESCE(ARRAY_AGG(m.user_id) FILTER (WHERE m.user_id IS NOT NULL), '{}') AS member_ids
    FROM teams t LEFT JOIN team_members m ON m.team_id = t.id`;

app.get('/teams', route(async (_req, res) => {
  const { rows } = await pool.query(`${TEAM_SELECT} GROUP BY t.id ORDER BY t.name`);
  res.json(rows.map(toTeam));
}));

app.post('/teams', route(async (req, res) => {
  const captainId = currentUser(req);
  const memberIds: string[] = Array.isArray(req.body?.memberIds) ? req.body.memberIds : [];
  const id = `team-${Date.now().toString(36)}`;

  // The row is re-read below with its members joined, so the insert's own row is unused.
  await pool.query(
    `INSERT INTO teams (id, name, sport, city, captain_id) VALUES ($1,$2,$3,$4,$5)`,
    [
      id,
      required(req.body?.name, 'name'),
      required(req.body?.sport, 'sport'),
      required(req.body?.city, 'city'),
      captainId,
    ],
  );

  // The captain is a member whether or not the client said so.
  for (const memberId of new Set([captainId, ...memberIds])) {
    await pool.query(
      'INSERT INTO team_members (team_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING',
      [id, memberId],
    );
  }

  const { rows: created } = await pool.query(`${TEAM_SELECT} WHERE t.id = $1 GROUP BY t.id`, [id]);
  res.status(201).json(toTeam(created[0]));
}));

app.get('/teams/:teamId', route(async (req, res) => {
  const { rows } = await pool.query(`${TEAM_SELECT} WHERE t.id = $1 GROUP BY t.id`, [
    req.params.teamId,
  ]);
  if (rows.length === 0) throw new ApiError('not_found', 'No such team');
  res.json(toTeam(rows[0]));
}));

app.get('/challenges', route(async (_req, res) => {
  const { rows } = await pool.query(
    "SELECT * FROM challenges WHERE status = 'open' ORDER BY proposed_start_at",
  );
  res.json(rows.map(toChallenge));
}));

app.get('/challenges/mine', route(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT c.* FROM challenges c
      WHERE c.challenger_team_id IN (SELECT team_id FROM team_members WHERE user_id = $1)
         OR c.opponent_team_id IN (SELECT team_id FROM team_members WHERE user_id = $1)
      ORDER BY c.proposed_start_at`,
    [currentUser(req)],
  );
  res.json(rows.map(toChallenge));
}));

app.get('/challenges/:challengeId', route(async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM challenges WHERE id = $1', [
    req.params.challengeId,
  ]);
  if (rows.length === 0) throw new ApiError('not_found', 'No such challenge');
  res.json(toChallenge(rows[0]));
}));

app.post('/challenges', route(async (req, res) => {
  const challengerTeamId = required(req.body?.challengerTeamId, 'challengerTeamId');
  const opponentTeamId = req.body?.opponentTeamId ?? null;

  // Committing a team to a fixture, and to a stake. The captain's call.
  await assertCaptain(challengerTeamId, currentUser(req));

  const { rows: teams } = await pool.query('SELECT sport FROM teams WHERE id = $1', [
    challengerTeamId,
  ]);
  if (teams.length === 0) throw new ApiError('not_found', 'No such team');

  const { rows } = await pool.query(
    `INSERT INTO challenges (
       id, type, challenger_team_id, opponent_team_id, sport, format, area,
       proposed_start_at, stake, status
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
    [
      `challenge-${Date.now().toString(36)}`,
      opponentTeamId ? 'direct' : 'open',
      challengerTeamId,
      opponentTeamId,
      // The sport comes from the team, never from the request.
      teams[0].sport,
      required(req.body?.format, 'format'),
      required(req.body?.area, 'area'),
      required(req.body?.proposedStartAt, 'proposedStartAt'),
      required(req.body?.stake, 'stake'),
      opponentTeamId ? 'accepted' : 'open',
    ],
  );
  res.status(201).json(toChallenge(rows[0]));
}));

app.post('/challenges/:challengeId/accept', route(async (req, res) => {
  const teamId = req.body?.teamId ?? null;
  if (teamId) await assertCaptain(teamId, currentUser(req));

  const { rows } = await pool.query(
    `UPDATE challenges SET status = 'accepted', opponent_team_id = COALESCE($2, opponent_team_id)
      WHERE id = $1 RETURNING *`,
    [req.params.challengeId, teamId],
  );
  if (rows.length === 0) throw new ApiError('not_found', 'No such challenge');
  res.json(toChallenge(rows[0]));
}));

app.post('/challenges/:challengeId/score', route(async (req, res) => {
  const teamId = required(req.body?.teamId, 'teamId');
  const challengerScore = Number(req.body?.challengerScore ?? 0);
  const opponentScore = Number(req.body?.opponentScore ?? 0);

  const { rows: found } = await pool.query('SELECT * FROM challenges WHERE id = $1', [
    req.params.challengeId,
  ]);
  if (found.length === 0) throw new ApiError('not_found', 'No such challenge');
  const challenge = found[0];

  if (teamId !== challenge.challenger_team_id && teamId !== challenge.opponent_team_id) {
    throw new ApiError('not_a_captain', 'Only the two teams playing can report a score.');
  }

  // Being one of the two teams is not enough — the caller has to be that team's captain,
  // or any member could report a result on their side's behalf.
  await assertCaptain(teamId, currentUser(req));

  const reports = {
    ...challenge.reported_scores,
    [teamId]: { challenger: challengerScore, opponent: opponentScore },
  };
  const values = Object.values(reports) as { challenger: number; opponent: number }[];
  const bothReported = values.length === 2;
  const agree =
    bothReported &&
    values[0].challenger === values[1].challenger &&
    values[0].opponent === values[1].opponent;

  const { rows } = await pool.query(
    `UPDATE challenges SET reported_scores = $2, status = CASE WHEN $3 THEN 'played' ELSE status END
      WHERE id = $1 RETURNING *`,
    [challenge.id, JSON.stringify(reports), agree],
  );

  // The leaderboard only moves on agreement (docs/04, Pillar 3).
  if (agree && challenge.opponent_team_id) {
    const challengerWon = values[0].challenger > values[0].opponent;
    const winner = challengerWon ? challenge.challenger_team_id : challenge.opponent_team_id;
    const loser = challengerWon ? challenge.opponent_team_id : challenge.challenger_team_id;
    if (values[0].challenger !== values[0].opponent) {
      await pool.query('UPDATE teams SET wins = wins + 1 WHERE id = $1', [winner]);
      await pool.query('UPDATE teams SET losses = losses + 1 WHERE id = $1', [loser]);
    }
  }

  res.json({
    challenge: toChallenge(rows[0]),
    settled: agree,
    disputed: bothReported && !agree,
  });
}));

// ------------------------------------------------------------------------------- chat --

app.get('/threads', route(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT t.*, tm.unread,
            COALESCE(ARRAY_AGG(m.user_id) FILTER (WHERE m.user_id IS NOT NULL), '{}') AS member_ids
       FROM chat_threads t
       JOIN thread_members tm ON tm.thread_id = t.id AND tm.user_id = $1
       LEFT JOIN thread_members m ON m.thread_id = t.id
      GROUP BY t.id, tm.unread
      ORDER BY t.last_message_at DESC`,
    [currentUser(req)],
  );
  res.json(rows.map(toThread));
}));

app.get('/threads/:threadId/messages', route(async (req, res) => {
  await assertThreadMember(req.params.threadId, currentUser(req));

  const { rows } = await pool.query(
    `SELECT m.*, p.full_name AS author_name
       FROM messages m JOIN players p ON p.id = m.author_id
      WHERE m.thread_id = $1 ORDER BY m.sent_at`,
    [req.params.threadId],
  );
  res.json(rows.map((row) => toMessage(row, currentUser(req))));
}));

app.post('/threads/:threadId/messages', route(async (req, res) => {
  const body = required(req.body?.body, 'body');
  const userId = currentUser(req);
  // Otherwise anyone with a thread id could both read a conversation and speak in it.
  await assertThreadMember(req.params.threadId, userId);

  const { rows } = await pool.query(
    `INSERT INTO messages (id, thread_id, author_id, body) VALUES ($1,$2,$3,$4) RETURNING *`,
    [`msg-${Date.now().toString(36)}`, req.params.threadId, userId, body],
  );
  await pool.query(
    'UPDATE chat_threads SET last_message = $2, last_message_at = now() WHERE id = $1',
    [req.params.threadId, body],
  );
  await pool.query(
    'UPDATE thread_members SET unread = 0 WHERE thread_id = $1 AND user_id = $2',
    [req.params.threadId, userId],
  );

  const { rows: authors } = await pool.query('SELECT full_name FROM players WHERE id = $1', [
    userId,
  ]);
  res.status(201).json(
    toMessage({ ...rows[0], author_name: authors[0]?.full_name ?? 'You' }, userId),
  );
}));

// ---------------------------------------------------------------- players and notices --

app.get('/players', route(async (req, res) => {
  const search = typeof req.query.query === 'string' ? req.query.query.trim() : '';
  const ids = typeof req.query.ids === 'string' ? req.query.ids.split(',').filter(Boolean) : null;

  if (ids) {
    const { rows } = await pool.query('SELECT * FROM players WHERE id = ANY($1)', [ids]);
    const byId = new Map(rows.map((row) => [row.id, toPlayer(row)]));
    res.json(ids.map((id) => byId.get(id)).filter(Boolean));
    return;
  }

  const { rows } = await pool.query(
    `SELECT * FROM players WHERE id <> $1 AND ($2 = '' OR full_name ILIKE $3) ORDER BY full_name`,
    [currentUser(req), search, `%${search}%`],
  );
  res.json(rows.map(toPlayer));
}));

app.get('/players/me', route(async (req, res) => {
  const playerId = currentUser(req);
  const { rows } = await pool.query('SELECT * FROM players WHERE id = $1', [playerId]);
  if (rows.length === 0) throw new ApiError('not_found', 'No such player');

  // Ownership is read from the venues, not from a column on the player. One answer to the
  // question means the two cannot drift apart.
  const { rows: owned } = await pool.query<{ id: string }>(
    'SELECT id FROM venues WHERE owner_id = $1 ORDER BY name',
    [playerId],
  );

  res.json(toCurrentPlayer(rows[0], owned.map((venue) => venue.id)));
}));

/**
 * Saves the setup choices, and the profile edits that share the screen with them.
 *
 * Only these fields. A PATCH that took whatever it was given would let a caller set their
 * own reliability, which is the number the whole no-show system rests on.
 */
app.patch('/players/me', route(async (req, res) => {
  const playerId = currentUser(req);
  const sports = Array.isArray(req.body?.sports) ? (req.body.sports as string[]) : undefined;
  const city = typeof req.body?.city === 'string' ? req.body.city : undefined;
  const fullName = typeof req.body?.fullName === 'string' ? req.body.fullName.trim() : undefined;

  const { rows } = await pool.query(
    `UPDATE players
        SET sports    = COALESCE($2, sports),
            city      = COALESCE($3, city),
            full_name = COALESCE($4, full_name)
      WHERE id = $1
      RETURNING *`,
    [playerId, sports ?? null, city ?? null, fullName || null],
  );
  if (rows.length === 0) throw new ApiError('not_found', 'No such player');

  const { rows: owned } = await pool.query<{ id: string }>(
    'SELECT id FROM venues WHERE owner_id = $1 ORDER BY name',
    [playerId],
  );

  res.json(toCurrentPlayer(rows[0], owned.map((venue) => venue.id)));
}));

app.get('/players/:playerId', route(async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM players WHERE id = $1', [req.params.playerId]);
  if (rows.length === 0) throw new ApiError('not_found', 'No such player');
  res.json(toPlayer(rows[0]));
}));

app.get('/notifications', route(async (req, res) => {
  const { rows } = await pool.query(
    'SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC',
    [currentUser(req)],
  );
  res.json(rows.map(toNotification));
}));

// ------------------------------------------------------------------------------ errors --

app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (error instanceof ApiError) {
    res.status(error.status).json({ error: { code: error.code, message: error.message } });
    return;
  }
  console.error(error);
  res.status(500).json({ error: { code: 'network', message: 'Something went wrong' } });
});

const port = Number(process.env.PORT ?? 4000);
app.listen(port, () => {
  console.log(`maidan api listening on http://localhost:${port}`);
});
