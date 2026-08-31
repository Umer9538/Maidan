/**
 * The session flows, against a real Postgres.
 *
 * These are integration tests on purpose. What matters here — a unique index catching two
 * registrations racing on one address, a refresh token being retired in the same
 * transaction that issues its successor, an OTP burning itself after six wrong guesses —
 * lives in SQL and in transaction boundaries, and a mocked pool would assert only that the
 * strings were spelled the way the test expected.
 *
 * Needs a database: `createdb maidan && npm run migrate --db=maidan`.
 */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';

process.env.AUTH_SECRET = 'test-secret-that-is-comfortably-over-32-characters';
process.env.NODE_ENV = 'test';

const { pool } = await import('./db.js');
const { resetSigningKey } = await import('./auth.js');
const { login, logout, refresh, register, requestOtp, verifyOtp, normalisePhone } = await import(
  './auth-service.js'
);
const { ApiError } = await import('./errors.js');

/** Every run gets its own identities, so a failed run cannot poison the next one. */
const run = randomUUID().slice(0, 8);
const email = `test-${run}@maidan.test`;
const created: string[] = [];

/** `03` plus nine digits — the shape `normalisePhone` accepts, and unique enough per run. */
function randomPhone(): string {
  return `03${String(Math.floor(Math.random() * 1e9)).padStart(9, '0')}`;
}

const phone = randomPhone();

async function registerFresh() {
  const session = await register({
    fullName: 'Test Player',
    email: `${randomUUID().slice(0, 8)}@maidan.test`,
    phone: randomPhone(),
    password: 'hunter2pass',
  });
  created.push(session.playerId);
  return session;
}

before(() => resetSigningKey());

after(async () => {
  // ON DELETE CASCADE takes the credentials, tokens and sessions with the player.
  if (created.length > 0) {
    await pool.query('DELETE FROM players WHERE id = ANY($1)', [created]);
  }
  await pool.query('DELETE FROM otp_codes WHERE phone LIKE $1', ['+92300%']);
  await pool.end();
});

describe('register', () => {
  it('creates a player and hands back a working session', async () => {
    const session = await register({
      fullName: 'Umer Farhan',
      email,
      phone,
      password: 'hunter2pass',
    });
    created.push(session.playerId);

    assert.ok(session.accessToken.length > 0);
    assert.ok(session.refreshToken.length > 0);
    assert.equal(session.expiresIn, 15 * 60);
  });

  it('normalises the phone number so one person is one account', async () => {
    // Someone typing 0300…, +92 300… and 92-300… must land on the same row, or OTP sends
    // a code to a number that will not match the account it later looks up.
    assert.equal(normalisePhone('0300 1234567'), '+923001234567');
    assert.equal(normalisePhone('+92 300 1234567'), '+923001234567');
    assert.equal(normalisePhone('92-300-1234567'), '+923001234567');
  });

  it('refuses a second account on the same email, whatever the casing', async () => {
    await assert.rejects(
      () => register({ fullName: 'Someone Else', email: email.toUpperCase(), phone: '03119876543', password: 'hunter2pass' }),
      (error: unknown) => error instanceof ApiError && error.code === 'already_registered',
    );
  });

  it('refuses a second account on the same number', async () => {
    await assert.rejects(
      () => register({ fullName: 'Someone Else', email: `other-${run}@maidan.test`, phone, password: 'hunter2pass' }),
      (error: unknown) => error instanceof ApiError && error.code === 'already_registered',
    );
  });
});

describe('login', () => {
  it('signs in with the right password', async () => {
    const session = await login(email, 'hunter2pass');
    assert.ok(session.accessToken.length > 0);
  });

  it('is case-insensitive about the email', async () => {
    const session = await login(email.toUpperCase(), 'hunter2pass');
    assert.ok(session.accessToken.length > 0);
  });

  it('gives the same answer for a wrong password and an unknown email', async () => {
    // Two different answers here is an account enumerator: it tells anyone who asks which
    // addresses are registered.
    const wrongPassword = await login(email, 'not-the-password').catch((e: unknown) => e);
    const noSuchAccount = await login('nobody@maidan.test', 'hunter2pass').catch((e: unknown) => e);

    assert.ok(wrongPassword instanceof ApiError);
    assert.ok(noSuchAccount instanceof ApiError);
    assert.equal(wrongPassword.code, 'invalid_credentials');
    assert.equal(noSuchAccount.code, 'invalid_credentials');
    assert.equal(wrongPassword.message, noSuchAccount.message);
  });
});

describe('refresh', () => {
  it('exchanges a refresh token for a new session', async () => {
    const first = await registerFresh();
    const second = await refresh(first.refreshToken);

    assert.notEqual(second.refreshToken, first.refreshToken);
    assert.equal(second.playerId, first.playerId);
  });

  it('retires the old token, so it cannot be spent twice', async () => {
    const first = await registerFresh();
    await refresh(first.refreshToken);

    await assert.rejects(
      () => refresh(first.refreshToken),
      (error: unknown) => error instanceof ApiError && error.code === 'unauthorized',
    );
  });

  it('revokes the whole family when a token is reused', async () => {
    // A token presented twice has leaked, and there is no way from here to tell whether
    // the second use was the owner or the thief. So neither of them keeps the session.
    const first = await registerFresh();
    const second = await refresh(first.refreshToken);

    await refresh(first.refreshToken).catch(() => {});

    await assert.rejects(
      () => refresh(second.refreshToken),
      (error: unknown) => error instanceof ApiError && error.code === 'unauthorized',
      'the successor should have been revoked along with the reused token',
    );
  });

  it('rejects a token that was never issued', async () => {
    await assert.rejects(
      () => refresh('not-a-real-token'),
      (error: unknown) => error instanceof ApiError && error.code === 'unauthorized',
    );
  });
});

describe('logout', () => {
  it('ends the session', async () => {
    const session = await registerFresh();
    await logout(session.refreshToken);

    await assert.rejects(
      () => refresh(session.refreshToken),
      (error: unknown) => error instanceof ApiError && error.code === 'unauthorized',
    );
  });

  it('succeeds on a token it has never seen', async () => {
    // Signing out must not be a way to ask whether a token exists.
    await logout('not-a-real-token');
  });
});

describe('otp', () => {
  const otpPhone = '03007654321';

  it('signs in a new number, creating the account', async () => {
    const challenge = await requestOtp(otpPhone);
    assert.ok(challenge.devCode);

    const session = await verifyOtp(otpPhone, challenge.devCode, 'Phone Player');
    created.push(session.playerId);

    assert.ok(session.accessToken.length > 0);
  });

  it('returns the same account the second time, not a duplicate', async () => {
    const challenge = await requestOtp(otpPhone);
    const session = await verifyOtp(otpPhone, challenge.devCode!);

    const { rows } = await pool.query('SELECT id FROM players WHERE phone = $1', [
      normalisePhone(otpPhone),
    ]);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].id, session.playerId);
  });

  it('rejects a wrong code', async () => {
    const challenge = await requestOtp(otpPhone);
    const wrong = challenge.devCode === '000000' ? '111111' : '000000';

    await assert.rejects(
      () => verifyOtp(otpPhone, wrong),
      (error: unknown) => error instanceof ApiError && error.code === 'invalid_credentials',
    );
  });

  it('cannot be replayed once used', async () => {
    const challenge = await requestOtp(otpPhone);
    await verifyOtp(otpPhone, challenge.devCode!);

    await assert.rejects(
      () => verifyOtp(otpPhone, challenge.devCode!),
      (error: unknown) => error instanceof ApiError,
    );
  });

  it('burns the code after six wrong guesses rather than just refusing them', async () => {
    // Refusing without burning turns a six-guess limit into an unlimited one: the next
    // request would start counting from zero against the same live code.
    const challenge = await requestOtp(otpPhone);
    const wrong = challenge.devCode === '000000' ? '111111' : '000000';

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await verifyOtp(otpPhone, wrong).catch(() => {});
    }

    await assert.rejects(
      () => verifyOtp(otpPhone, wrong),
      (error: unknown) => error instanceof ApiError && error.code === 'rate_limited',
    );

    // Even the right code is dead now.
    await assert.rejects(
      () => verifyOtp(otpPhone, challenge.devCode!),
      (error: unknown) => error instanceof ApiError,
    );
  });

  it('caps how many codes one number can be sent', async () => {
    // Otherwise this endpoint makes someone else's phone ring all night, at our cost.
    const target = '03001112223';
    for (let sent = 0; sent < 5; sent += 1) {
      await requestOtp(target).catch(() => {});
    }

    await assert.rejects(
      () => requestOtp(target),
      (error: unknown) => error instanceof ApiError && error.code === 'rate_limited',
    );
  });
});
