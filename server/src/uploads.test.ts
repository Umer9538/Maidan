/**
 * What the upload path refuses.
 *
 * An upload endpoint is the one place a client hands over bytes and a filename, and both
 * are whatever the sender says they are. Every test here asserts a rejection, because a
 * file that gets stored when it should not is not a failing feature — it is somebody else's
 * malware on our disk under a name we chose to trust.
 */
import assert from 'node:assert/strict';
import { readdir, rm } from 'node:fs/promises';
import { after, describe, it } from 'node:test';

const { MAX_UPLOAD_BYTES, UPLOAD_DIR, store } = await import('./uploads.js');
const { ApiError } = await import('./errors.js');

/** A real one-pixel PNG, so the happy path is not testing against our own idea of a PNG. */
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64)]);
const stored: string[] = [];

after(async () => {
  for (const name of stored) {
    await rm(`${UPLOAD_DIR}/${name}`, { force: true });
  }
});

describe('store', () => {
  it('writes an image and returns where it is served', async () => {
    const url = await store(PNG);
    stored.push(url.split('/').pop()!);

    assert.match(url, /^\/uploads\/[0-9a-f-]{36}\.png$/);
    assert.ok((await readdir(UPLOAD_DIR)).includes(url.split('/').pop()!));
  });

  it('names the file itself', async () => {
    // The only defence against a filename with `../` in it is never using the one we were
    // given. Two uploads of identical bytes must also not collide.
    const [a, b] = await Promise.all([store(PNG), store(PNG)]);
    stored.push(a.split('/').pop()!, b.split('/').pop()!);

    assert.notEqual(a, b);
  });

  it('accepts the formats a phone camera produces', async () => {
    const url = await store(JPEG);
    stored.push(url.split('/').pop()!);
    assert.match(url, /\.jpg$/);
  });

  it('refuses anything that is not an image, whatever it claims to be', async () => {
    // A shell script with a .png name is still a shell script. The magic bytes are the only
    // part of an upload the sender cannot simply assert.
    await assert.rejects(
      () => store(Buffer.from('#!/bin/sh\nrm -rf /\n')),
      (error: unknown) => error instanceof ApiError && error.code === 'validation',
    );
  });

  it('refuses an empty file', async () => {
    await assert.rejects(
      () => store(Buffer.alloc(0)),
      (error: unknown) => error instanceof ApiError,
    );
  });

  it('refuses one too large to be a photo', async () => {
    // Unbounded uploads are how a disk fills up.
    const huge = Buffer.concat([PNG, Buffer.alloc(MAX_UPLOAD_BYTES)]);
    await assert.rejects(
      () => store(huge),
      (error: unknown) => error instanceof ApiError && error.code === 'validation',
    );
  });
});
