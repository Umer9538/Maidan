/**
 * Sessions: who is signing in, and what they get back.
 *
 * A session is a short access token plus a long refresh token. The access token is signed
 * and stateless, so no request needs a database round trip to establish who is calling;
 * the refresh token is a row, so a session can actually be ended. Neither half is stored
 * anywhere it could be read back.
 *
 * Two behaviours below exist because of how these flows are attacked rather than how they
 * are used, and both are easy to lose in a refactor:
 *
 *   1. **Sign-in never says which half was wrong.** "No such email" and "wrong password"
 *      are the same answer, and a missing account still pays for a password hash, because
 *      an endpoint that answers faster for unknown emails is an account enumerator.
 *   2. **Refresh tokens rotate, and reuse burns the family.** A token presented twice is a
 *      token that leaked, and the honest client will present the stolen one sooner or
 *      later — so the whole chain is revoked and both parties have to sign in again.
 */
import { randomUUID } from 'node:crypto';

import {
  ACCESS_TOKEN_TTL_SECONDS,
  OTP_MAX_ATTEMPTS,
  OTP_TTL_SECONDS,
  REFRESH_TOKEN_TTL_SECONDS,
  hashOpaqueToken,
  hashOtpCode,
  hashPassword,
  newOtpCode,
  newRefreshToken,
  signAccessToken,
  verifyPassword,
} from './auth.js';
import { PG, isPgError, pool, tx, type Db } from './db.js';
import { ApiError } from './errors.js';

export interface Session {
  accessToken: string;
  refreshToken: string;
  /** Seconds until the access token expires, so the client can refresh before it does. */
  expiresIn: number;
  playerId: string;
}

/** How many codes one number may be sent in an hour before it has to wait. */
const OTP_SENDS_PER_HOUR = 5;

/**
 * A hash of nothing in particular, used to keep sign-in honest about its timing.
 *
 * `verifyPassword` against this costs the same as against a real row, so an unknown email
 * takes as long to reject as a known one with the wrong password.
 */
let decoyHash: string | null = null;

async function decoy(): Promise<string> {
  decoyHash ??= await hashPassword(randomUUID());
  return decoyHash;
}

/** Lowercased and trimmed. `Umer@…` and `umer@…` are one account. */
function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * To `+92XXXXXXXXXX`.
 *
 * People write their number as `0300 1234567`, `+92 300 1234567` or `92-300-1234567`, and
 * all three have to land on the same account or OTP sign-in sends a code to a number that
 * does not match the row it will later look up.
 */
export function normalisePhone(input: string): string {
  const digits = input.replace(/\D/g, '');
  const local = digits.replace(/^92/, '').replace(/^0/, '');
  if (local.length !== 10) {
    throw new ApiError('validation', 'Enter a Pakistani mobile number, like 0300 1234567');
  }
  return `+92${local}`;
}

// -------------------------------------------------------------------------- sessions --

async function issueSession(db: Db, playerId: string): Promise<Session> {
  const { token, hash } = newRefreshToken();
  const id = `refresh-${randomUUID()}`;

  await db.query(
    `INSERT INTO refresh_tokens (id, player_id, token_hash, expires_at)
     VALUES ($1, $2, $3, now() + make_interval(secs => $4))`,
    [id, playerId, hash, REFRESH_TOKEN_TTL_SECONDS],
  );

  return {
    accessToken: signAccessToken(playerId),
    refreshToken: token,
    expiresIn: ACCESS_TOKEN_TTL_SECONDS,
    playerId,
  };
}

export interface RegisterInput {
  fullName: string;
  email: string;
  phone: string;
  password: string;
}

export async function register(input: RegisterInput): Promise<Session> {
  const email = normaliseEmail(input.email);
  const phone = normalisePhone(input.phone);
  const passwordHash = await hashPassword(input.password);
  const playerId = `player-${randomUUID()}`;

  return tx(async (db) => {
    try {
      await db.query(
        `INSERT INTO players (id, full_name, email, phone, skill_by_sport)
         VALUES ($1, $2, $3, $4, '{}'::jsonb)`,
        [playerId, input.fullName.trim(), email, phone],
      );
    } catch (error) {
      // The unique indexes on lower(email) and phone are the authority here, not a SELECT
      // beforehand — two registrations racing on the same address would both pass a check
      // and only the constraint would catch the second.
      if (isPgError(error, PG.UNIQUE_VIOLATION)) {
        throw new ApiError('already_registered', 'That email or number already has an account');
      }
      throw error;
    }

    await db.query('INSERT INTO credentials (player_id, password_hash) VALUES ($1, $2)', [
      playerId,
      passwordHash,
    ]);

    return issueSession(db, playerId);
  });
}

export async function login(email: string, password: string): Promise<Session> {
  const { rows } = await pool.query<{ id: string; password_hash: string }>(
    `SELECT p.id, c.password_hash
       FROM players p
       JOIN credentials c ON c.player_id = p.id
      WHERE lower(p.email) = $1`,
    [normaliseEmail(email)],
  );

  const row = rows[0];
  // Both branches hash. Returning early for an unknown email would make this endpoint an
  // oracle for which addresses have accounts, measurable over the network.
  const ok = await verifyPassword(password, row?.password_hash ?? (await decoy()));

  if (!row || !ok) {
    throw new ApiError('invalid_credentials', 'That email and password do not match an account');
  }

  return tx((db) => issueSession(db, row.id));
}

/**
 * Exchanges a refresh token for a new session and retires the old one.
 *
 * The `replaced_by` chain is what makes reuse visible. A token that already points at a
 * successor is one that was used twice — either the client replayed it or someone else
 * has a copy, and there is no way to tell which from here. So the whole family goes.
 */
export async function refresh(refreshToken: string): Promise<Session> {
  const hash = hashOpaqueToken(refreshToken);

  // The refusal is returned rather than thrown, because throwing out of `tx` rolls the
  // transaction back — and the revocation this path exists to perform would go with it.
  // A security write and the error that reports it cannot share a transaction.
  const outcome = await tx<{ session: Session } | null>(async (db) => {
    const { rows } = await db.query<{
      id: string;
      player_id: string;
      revoked: boolean;
      expired: boolean;
      replaced_by: string | null;
    }>(
      `SELECT id, player_id, replaced_by,
              revoked_at IS NOT NULL AS revoked,
              expires_at <= now() AS expired
         FROM refresh_tokens
        WHERE token_hash = $1
        FOR UPDATE`,
      [hash],
    );

    const row = rows[0];
    if (!row) return null;

    if (row.replaced_by !== null) {
      await revokeAllFor(db, row.player_id);
      return null;
    }

    if (row.revoked || row.expired) return null;

    const next = await issueSession(db, row.player_id);
    await db.query(
      `UPDATE refresh_tokens
          SET revoked_at = now(),
              replaced_by = (SELECT id FROM refresh_tokens WHERE token_hash = $2)
        WHERE id = $1`,
      [row.id, hashOpaqueToken(next.refreshToken)],
    );

    return { session: next };
  });

  if (!outcome) throw new ApiError('unauthorized', 'Sign in again');
  return outcome.session;
}

/** Ends one session. Unknown tokens succeed silently: signing out must not probe for a row. */
export async function logout(refreshToken: string): Promise<void> {
  await pool.query(
    'UPDATE refresh_tokens SET revoked_at = now() WHERE token_hash = $1 AND revoked_at IS NULL',
    [hashOpaqueToken(refreshToken)],
  );
}

async function revokeAllFor(db: Db, playerId: string): Promise<void> {
  await db.query(
    'UPDATE refresh_tokens SET revoked_at = now() WHERE player_id = $1 AND revoked_at IS NULL',
    [playerId],
  );
}

// ------------------------------------------------------------------------------- otp --

export interface OtpChallenge {
  phone: string;
  expiresInSeconds: number;
  /**
   * The code itself, and only outside production. There is no SMS provider yet, so
   * without this nobody could complete the flow on a development machine.
   */
  devCode?: string;
}

export async function requestOtp(rawPhone: string): Promise<OtpChallenge> {
  const phone = normalisePhone(rawPhone);

  const { rows } = await pool.query<{ sent: string }>(
    `SELECT count(*) AS sent FROM otp_codes
      WHERE phone = $1 AND created_at > now() - interval '1 hour'`,
    [phone],
  );

  // A cap on sends, not just on guesses. Without it this endpoint is a way to make someone
  // else's phone ring all night, at our cost per message.
  if (Number(rows[0].sent) >= OTP_SENDS_PER_HOUR) {
    throw new ApiError('rate_limited', 'Too many codes requested. Try again in an hour.');
  }

  const { code, hash } = newOtpCode(phone);
  await pool.query(
    `INSERT INTO otp_codes (id, phone, code_hash, expires_at)
     VALUES ($1, $2, $3, now() + make_interval(secs => $4))`,
    [`otp-${randomUUID()}`, phone, hash, OTP_TTL_SECONDS],
  );

  // Stands in for the SMS provider. Deliberately loud, so it is obvious this is not sending.
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[auth] OTP for ${phone} is ${code} (no SMS provider configured)`);
  }

  return {
    phone,
    expiresInSeconds: OTP_TTL_SECONDS,
    devCode: process.env.NODE_ENV === 'production' ? undefined : code,
  };
}

/**
 * Verifies a code and signs the player in, registering them if the number is new.
 *
 * OTP is the only route that both authenticates and creates: for most of this market the
 * phone number *is* the account, and asking someone to pick a password before they have
 * seen a single ground is how you lose them.
 */
export async function verifyOtp(rawPhone: string, code: string, fullName?: string): Promise<Session> {
  const phone = normalisePhone(rawPhone);

  // As in `refresh`: failures are returned, not thrown. Throwing out of `tx` rolls the
  // transaction back, and the attempt counter this whole flow rests on would roll back
  // with it — leaving a six-guess limit that never counts past one.
  type Outcome =
    | { kind: 'ok'; session: Session }
    | { kind: 'expired' }
    | { kind: 'wrong' }
    | { kind: 'burned' };

  const outcome = await tx<Outcome>(async (db) => {
    const { rows } = await db.query<{ id: string; code_hash: string; attempts: number }>(
      `SELECT id, code_hash, attempts
         FROM otp_codes
        WHERE phone = $1 AND consumed_at IS NULL AND expires_at > now()
        ORDER BY created_at DESC
        LIMIT 1
        FOR UPDATE`,
      [phone],
    );

    const row = rows[0];
    if (!row) return { kind: 'expired' };

    if (row.code_hash !== hashOtpCode(phone, code)) {
      // Counted and burned in one statement. Reading the count and then writing it leaves
      // a gap two simultaneous guesses can both pass through, and burning on the same
      // update is what stops a refused code staying live for another six attempts.
      const { rows: after } = await db.query<{ consumed_at: Date | null }>(
        `UPDATE otp_codes
            SET attempts = attempts + 1,
                consumed_at = CASE WHEN attempts + 1 >= $2 THEN now() ELSE consumed_at END
          WHERE id = $1
        RETURNING consumed_at`,
        [row.id, OTP_MAX_ATTEMPTS],
      );
      return after[0].consumed_at ? { kind: 'burned' } : { kind: 'wrong' };
    }

    await db.query('UPDATE otp_codes SET consumed_at = now() WHERE id = $1', [row.id]);

    const existing = await db.query<{ id: string }>('SELECT id FROM players WHERE phone = $1', [
      phone,
    ]);

    let playerId = existing.rows[0]?.id;
    if (!playerId) {
      playerId = `player-${randomUUID()}`;
      await db.query(
        `INSERT INTO players (id, full_name, phone, skill_by_sport)
         VALUES ($1, $2, $3, '{}'::jsonb)`,
        [playerId, fullName?.trim() || 'Player', phone],
      );
    }

    return { kind: 'ok', session: await issueSession(db, playerId) };
  });

  switch (outcome.kind) {
    case 'ok':
      return outcome.session;
    case 'burned':
      throw new ApiError('rate_limited', 'Too many wrong codes. Ask for a new one.');
    case 'wrong':
      throw new ApiError('invalid_credentials', 'That code is not right');
    case 'expired':
      throw new ApiError('invalid_credentials', 'That code has expired. Ask for a new one.');
  }
}
