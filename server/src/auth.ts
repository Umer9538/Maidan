/**
 * Password hashing, token minting and OTP codes.
 *
 * Kept to Node's own crypto rather than a dependency: every primitive needed here is in
 * `node:crypto`, and a library would mostly be wrapping the same three calls.
 *
 * Three different hashes appear below, and the differences are deliberate:
 *
 *   - Passwords use **scrypt**. They are low-entropy and chosen by people, so the hash has
 *     to be slow and memory-hard or a leaked table is a wordlist away from being plaintext.
 *   - Refresh tokens use **SHA-256**. They are 256 bits of randomness we generated, so
 *     there is nothing to guess and a deliberately slow hash would only cost us latency.
 *   - OTP codes use **SHA-256 with the phone number mixed in**. Six digits is small enough
 *     to rainbow-table outright; binding the digest to the number it was sent to means a
 *     stolen table cannot be reversed once and reused everywhere.
 */
import {
  createHmac,
  randomBytes,
  randomInt,
  scrypt as scryptCallback,
  timingSafeEqual,
  type ScryptOptions,
} from 'node:crypto';
import { promisify } from 'node:util';

// `promisify` picks the overload without options, which is the only one we do not want.
const scrypt = promisify(scryptCallback) as (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number,
  options: ScryptOptions,
) => Promise<Buffer>;

/**
 * scrypt cost. N=16384 is the widely published interactive baseline — roughly 100ms and
 * 16MB per hash on a small server, which is slow enough to make offline cracking painful
 * and fast enough that signing in does not feel broken on a bad connection.
 */
const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 32 } as const;

/** 15 minutes. Short enough that a stolen access token is a narrow window. */
export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;

/**
 * 30 days. Long enough that a player who books once a fortnight is never asked to sign in
 * again, and revocable at any point because the row lives in the database.
 */
export const REFRESH_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60;

/** Five minutes. An SMS that takes longer than this has not arrived. */
export const OTP_TTL_SECONDS = 5 * 60;

/** Six guesses at six digits. Past that the code is burned, not merely rejected. */
export const OTP_MAX_ATTEMPTS = 6;

// ------------------------------------------------------------------------- passwords --

/**
 * `N$r$p$salt$hash`, all base64. The parameters travel with the hash so raising the cost
 * later does not invalidate every password already stored.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = await scrypt(password.normalize('NFKC'), salt, SCRYPT.keylen, {
    N: SCRYPT.N,
    r: SCRYPT.r,
    p: SCRYPT.p,
  });

  return [SCRYPT.N, SCRYPT.r, SCRYPT.p, salt.toString('base64'), derived.toString('base64')].join(
    '$',
  );
}

/**
 * Constant time in the comparison, and false rather than a throw on anything malformed —
 * a corrupt row should fail the sign-in, not take the process down.
 */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 5) return false;

  const [n, r, p, salt, expected] = parts;
  const expectedBuffer = Buffer.from(expected, 'base64');
  if (expectedBuffer.length === 0) return false;

  try {
    const derived = await scrypt(
      password.normalize('NFKC'),
      Buffer.from(salt, 'base64'),
      expectedBuffer.length,
      { N: Number(n), r: Number(r), p: Number(p) },
    );

    return timingSafeEqual(derived, expectedBuffer);
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------- access tokens --

/**
 * The signing key.
 *
 * Production refuses to start without one: a default secret in a shipped binary is the
 * same as no signature at all. Development generates a throwaway, so `npm run dev` works
 * on a fresh clone — at the cost of every token dying on restart, which the warning says.
 */
function readSecret(): Buffer {
  const configured = process.env.AUTH_SECRET;
  if (configured && configured.length >= 32) return Buffer.from(configured, 'utf8');

  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'AUTH_SECRET must be set to at least 32 characters in production. ' +
        'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'base64url\'))"',
    );
  }

  if (configured) {
    throw new Error('AUTH_SECRET is set but shorter than 32 characters. Use a longer one.');
  }

  console.warn(
    '[auth] AUTH_SECRET is not set. Using a throwaway key — every token dies on restart.',
  );
  return randomBytes(48);
}

let secret: Buffer | null = null;

function signingKey(): Buffer {
  // Read on first use, not at import, so a test can set the variable before touching this.
  secret ??= readSecret();
  return secret;
}

/** Test seam: drops the memoised key so a new AUTH_SECRET takes effect. */
export function resetSigningKey(): void {
  secret = null;
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64url');
}

function sign(data: string): string {
  return createHmac('sha256', signingKey()).update(data).digest('base64url');
}

export interface AccessClaims {
  /** The player this token speaks for. */
  sub: string;
  /** Seconds since the epoch. */
  exp: number;
  iat: number;
}

/**
 * A JWT, but the algorithm is never read from the token.
 *
 * This is the whole defence against algorithm confusion — the attack where a token
 * arrives claiming `"alg":"none"` and a verifier that dispatches on that field politely
 * skips the signature. Here the header is written by us and the signature is checked over
 * the exact bytes received with the one algorithm we use, before anything is parsed.
 */
export function signAccessToken(playerId: string, now = new Date()): string {
  const issued = Math.floor(now.getTime() / 1000);
  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const claims: AccessClaims = {
    sub: playerId,
    iat: issued,
    exp: issued + ACCESS_TOKEN_TTL_SECONDS,
  };
  const body = base64url(JSON.stringify(claims));

  return `${header}.${body}.${sign(`${header}.${body}`)}`;
}

/** The claims, or null for anything we would not act on. Never throws on bad input. */
export function verifyAccessToken(token: string, now = new Date()): AccessClaims | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [header, body, signature] = parts;

  const expected = Buffer.from(sign(`${header}.${body}`), 'utf8');
  const received = Buffer.from(signature, 'utf8');
  // Length is checked first because `timingSafeEqual` throws on a mismatch, and the length
  // of a signature is not a secret.
  if (expected.length !== received.length) return null;
  if (!timingSafeEqual(expected, received)) return null;

  let claims: AccessClaims;
  try {
    claims = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as AccessClaims;
  } catch {
    return null;
  }

  if (typeof claims.sub !== 'string' || claims.sub.length === 0) return null;
  if (typeof claims.exp !== 'number') return null;
  if (claims.exp <= Math.floor(now.getTime() / 1000)) return null;

  return claims;
}

// --------------------------------------------------------------------- refresh tokens --

export interface OpaqueToken {
  /** Handed to the client. Never stored. */
  token: string;
  /** Stored. Cannot be turned back into the token. */
  hash: string;
}

export function newRefreshToken(): OpaqueToken {
  const token = randomBytes(32).toString('base64url');
  return { token, hash: hashOpaqueToken(token) };
}

export function hashOpaqueToken(token: string): string {
  // Keyed with the same secret, so a stolen database is not enough to forge a lookup.
  return createHmac('sha256', signingKey()).update(token).digest('hex');
}

// ------------------------------------------------------------------------- otp codes --

export interface OtpCode {
  /** Sent by SMS. Never stored. */
  code: string;
  hash: string;
}

/**
 * `randomInt` and not `Math.random()`: this is a credential, and a predictable one is no
 * credential at all.
 */
export function newOtpCode(phone: string): OtpCode {
  const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
  return { code, hash: hashOtpCode(phone, code) };
}

export function hashOtpCode(phone: string, code: string): string {
  return createHmac('sha256', signingKey()).update(`${phone}:${code}`).digest('hex');
}
