/**
 * The primitives under the whole authorisation story. Most of these assert what must NOT
 * work — a token that verifies when it should not is not a failing feature, it is an open
 * door, and none of these cases fail loudly on their own.
 */
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { after, before, describe, it } from 'node:test';

process.env.AUTH_SECRET = 'test-secret-that-is-comfortably-over-32-characters';

const {
  ACCESS_TOKEN_TTL_SECONDS,
  hashOpaqueToken,
  hashOtpCode,
  hashPassword,
  newOtpCode,
  newRefreshToken,
  resetSigningKey,
  signAccessToken,
  verifyAccessToken,
  verifyPassword,
} = await import('./auth.js');

before(() => resetSigningKey());
after(() => resetSigningKey());

describe('passwords', () => {
  it('accepts the right password', async () => {
    const stored = await hashPassword('correct horse battery staple');
    assert.equal(await verifyPassword('correct horse battery staple', stored), true);
  });

  it('rejects the wrong one', async () => {
    const stored = await hashPassword('correct horse battery staple');
    assert.equal(await verifyPassword('correct horse battery stapl', stored), false);
  });

  it('never stores the password itself', async () => {
    const stored = await hashPassword('hunter2pass');
    assert.equal(stored.includes('hunter2pass'), false);
  });

  it('salts, so the same password twice gives two different hashes', async () => {
    // Without this, equal hashes in a leaked table would announce which accounts share a
    // password, and one crack would open all of them.
    const a = await hashPassword('hunter2pass');
    const b = await hashPassword('hunter2pass');
    assert.notEqual(a, b);
    assert.equal(await verifyPassword('hunter2pass', b), true);
  });

  it('treats the same characters written two ways as the same password', async () => {
    // "é" composed vs decomposed. A phone keyboard may send either, and a player who can
    // sign in on one device and not another has no way to work out why.
    const stored = await hashPassword('cafépass1');
    assert.equal(await verifyPassword('cafépass1', stored), true);
  });

  it('returns false rather than throwing on a corrupt row', async () => {
    for (const junk of ['', 'not-a-hash', '1$2$3', '$$$$']) {
      assert.equal(await verifyPassword('anything', junk), false);
    }
  });
});

describe('access tokens', () => {
  it('round-trips the player it was issued for', () => {
    const token = signAccessToken('player-self');
    assert.equal(verifyAccessToken(token)?.sub, 'player-self');
  });

  it('rejects a token whose claims were edited', () => {
    // The attack: take your own valid token, swap the subject for someone else's id.
    const [header, , signature] = signAccessToken('player-self').split('.');
    const forged = Buffer.from(
      JSON.stringify({ sub: 'player-ali', iat: 0, exp: 9_999_999_999 }),
    ).toString('base64url');

    assert.equal(verifyAccessToken(`${header}.${forged}.${signature}`), null);
  });

  it('rejects "alg":"none", signature stripped', () => {
    // The classic JWT forgery. It fails here because the algorithm is never read from the
    // token — the signature is checked with ours before anything is parsed.
    const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
    const body = Buffer.from(
      JSON.stringify({ sub: 'player-ali', iat: 0, exp: 9_999_999_999 }),
    ).toString('base64url');

    assert.equal(verifyAccessToken(`${header}.${body}.`), null);
    assert.equal(verifyAccessToken(`${header}.${body}.anything`), null);
  });

  it('rejects a token signed with a different key', () => {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const body = Buffer.from(
      JSON.stringify({ sub: 'player-ali', iat: 0, exp: 9_999_999_999 }),
    ).toString('base64url');
    const signature = createHmac('sha256', 'some-other-secret-entirely-32-chars')
      .update(`${header}.${body}`)
      .digest('base64url');

    assert.equal(verifyAccessToken(`${header}.${body}.${signature}`), null);
  });

  it('rejects an expired token', () => {
    const issued = new Date('2026-09-01T10:00:00Z');
    const token = signAccessToken('player-self', issued);
    const afterExpiry = new Date(issued.getTime() + (ACCESS_TOKEN_TTL_SECONDS + 1) * 1000);

    assert.equal(verifyAccessToken(token, issued)?.sub, 'player-self');
    assert.equal(verifyAccessToken(token, afterExpiry), null);
  });

  it('rejects malformed input instead of throwing', () => {
    for (const junk of ['', 'a', 'a.b', 'a.b.c.d', '...', 'not.base64.at-all']) {
      assert.equal(verifyAccessToken(junk), null);
    }
  });
});

describe('refresh tokens', () => {
  it('hands out a token whose stored form cannot be read back', () => {
    const { token, hash } = newRefreshToken();
    assert.equal(hash.includes(token), false);
    assert.equal(hashOpaqueToken(token), hash);
  });

  it('does not repeat itself', () => {
    const seen = new Set(Array.from({ length: 200 }, () => newRefreshToken().token));
    assert.equal(seen.size, 200);
  });
});

describe('otp codes', () => {
  it('is six digits', () => {
    for (let i = 0; i < 50; i += 1) {
      assert.match(newOtpCode('+923001234567').code, /^\d{6}$/);
    }
  });

  it('binds the hash to the number it was sent to', () => {
    // Six digits is small enough to tabulate. Mixing the number in means a table built
    // once cannot be reused against every other account.
    const { code, hash } = newOtpCode('+923001234567');
    assert.equal(hashOtpCode('+923001234567', code), hash);
    assert.notEqual(hashOtpCode('+923009999999', code), hash);
  });
});
