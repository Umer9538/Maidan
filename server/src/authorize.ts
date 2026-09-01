/**
 * Who is calling, and what they are allowed to touch.
 *
 * Until now the caller's id arrived in an `x-user-id` header and was believed, which made
 * every endpoint effectively public. Anyone who could reach the server could cancel a
 * stranger's booking, read a venue's day of customer names and phone numbers, or pull its
 * takings — by editing one header.
 *
 * Two rules hold everything below together:
 *
 *   1. **Authentication is default-on.** `requireAuth` is mounted before the routes, and
 *      only the paths in `PUBLIC` skip it. A new endpoint is therefore protected by
 *      default; forgetting to add a guard fails closed rather than open.
 *   2. **Ownership is asserted where the row is, not where the request came from.** Every
 *      helper here reads the row and compares it to the caller, so a handler cannot be
 *      talked into acting on someone else's record by a well-chosen parameter.
 */
import type { NextFunction, Request, Response } from 'express';

import { verifyAccessToken } from './auth.js';
import { pool } from './db.js';
import { ApiError } from './errors.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** Set by `requireAuth`. Absent only on the public routes. */
      playerId?: string;
    }
  }
}

/**
 * The only paths that do not need a token.
 *
 * Everything else — including browsing grounds — is behind sign-in, because the app is
 * too: there is no signed-out surface to serve. Keeping the list this short is what makes
 * "protected by default" true rather than aspirational.
 */
const PUBLIC = new Set(['/health', '/auth/register', '/auth/login', '/auth/otp', '/auth/otp/verify', '/auth/refresh', '/auth/logout']);

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  if (PUBLIC.has(req.path)) {
    next();
    return;
  }

  const header = req.header('authorization') ?? '';
  const [scheme, token] = header.split(' ');

  if (scheme?.toLowerCase() !== 'bearer' || !token) {
    next(new ApiError('unauthorized', 'Sign in to continue'));
    return;
  }

  const claims = verifyAccessToken(token);
  if (!claims) {
    // Expired and forged are the same answer. The client's move is identical either way:
    // try the refresh token, then send the player back to sign-in.
    next(new ApiError('unauthorized', 'Sign in to continue'));
    return;
  }

  req.playerId = claims.sub;
  next();
}

/**
 * The caller, on a route that has been through `requireAuth`.
 *
 * Throws rather than defaulting to anyone. The old `currentUser` fell back to
 * `'player-self'` when the header was missing, which meant a request with no identity at
 * all still acted as a real account.
 */
export function currentUser(req: Request): string {
  if (!req.playerId) throw new ApiError('unauthorized', 'Sign in to continue');
  return req.playerId;
}

// ------------------------------------------------------------------------ assertions --

/**
 * "Not found" and "not yours" give the same answer.
 *
 * Distinguishing them turns any id parameter into a probe for which records exist — and
 * booking ids and venue ids are guessable enough for that to matter.
 */
function deny(): never {
  throw new ApiError('not_found', 'No such record');
}

export async function assertOwnsBooking(bookingId: string, playerId: string): Promise<void> {
  const { rows } = await pool.query<{ user_id: string }>(
    'SELECT user_id FROM bookings WHERE id = $1',
    [bookingId],
  );
  if (rows.length === 0 || rows[0].user_id !== playerId) deny();
}

/**
 * A booking is readable by the player who made it and by the venue's owner — the owner has
 * to see who is coming, and it is their court.
 */
export async function assertCanSeeBooking(bookingId: string, playerId: string): Promise<void> {
  const { rows } = await pool.query<{ user_id: string; owner_id: string }>(
    `SELECT b.user_id, v.owner_id
       FROM bookings b
       JOIN venues v ON v.id = b.venue_id
      WHERE b.id = $1`,
    [bookingId],
  );
  const row = rows[0];
  if (!row || (row.user_id !== playerId && row.owner_id !== playerId)) deny();
}

export async function assertOwnsVenue(venueId: string, playerId: string): Promise<void> {
  const { rows } = await pool.query<{ owner_id: string }>(
    'SELECT owner_id FROM venues WHERE id = $1',
    [venueId],
  );
  if (rows.length === 0 || rows[0].owner_id !== playerId) deny();
}

/** A court is the venue's, so the question is really about the ground it sits on. */
export async function assertOwnsCourt(courtId: string, playerId: string): Promise<void> {
  const { rows } = await pool.query<{ owner_id: string }>(
    `SELECT v.owner_id
       FROM courts c
       JOIN venues v ON v.id = c.venue_id
      WHERE c.id = $1`,
    [courtId],
  );
  if (rows.length === 0 || rows[0].owner_id !== playerId) deny();
}

export async function assertThreadMember(threadId: string, playerId: string): Promise<void> {
  const { rows } = await pool.query(
    'SELECT 1 FROM thread_members WHERE thread_id = $1 AND user_id = $2',
    [threadId, playerId],
  );
  if (rows.length === 0) deny();
}

/** Posting a challenge or reporting a score is the captain's to do, not any member's. */
export async function assertCaptain(teamId: string, playerId: string): Promise<void> {
  const { rows } = await pool.query<{ captain_id: string }>(
    'SELECT captain_id FROM teams WHERE id = $1',
    [teamId],
  );
  if (rows.length === 0) deny();
  if (rows[0].captain_id !== playerId) {
    throw new ApiError('not_a_captain', 'Only the captain can do that');
  }
}

export async function assertHostsMatch(matchId: string, playerId: string): Promise<void> {
  const { rows } = await pool.query<{ host_id: string }>(
    'SELECT host_id FROM open_matches WHERE id = $1',
    [matchId],
  );
  if (rows.length === 0 || rows[0].host_id !== playerId) deny();
}
