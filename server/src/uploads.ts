/**
 * Photo uploads.
 *
 * Files land on local disk under `uploads/` and are served straight back. That is a real,
 * working implementation for a single server and an explicit stop-gap for anything else:
 * two instances would each hold half the photos, and a redeploy that replaces the disk
 * loses them. The seam is deliberately narrow — `store()` and a URL — so swapping in S3 or
 * Cloudflare R2 later touches this file and nothing that calls it.
 *
 * Three limits, and none of them are about tidiness:
 *
 *   - **Size.** An unbounded upload endpoint is a way to fill the disk, and a phone camera
 *     produces 4MB photos without trying.
 *   - **Type.** Only images, checked against the magic bytes rather than the filename or
 *     the client's `Content-Type`, because both of those are whatever the uploader says.
 *   - **Name.** The stored name is generated here. A filename that arrives from a client is
 *     attacker-controlled text, and `../../` in one is how an upload becomes a write
 *     anywhere on the disk.
 */
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { ApiError } from './errors.js';

export const UPLOAD_DIR = path.resolve(process.cwd(), 'uploads');

/** 5MB. Comfortably above a phone photo, far below anything that hurts. */
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

/**
 * Magic bytes, not the declared type.
 *
 * `Content-Type` and the filename both come from whoever is uploading. The first few bytes
 * of the file are the only part of this that the sender cannot simply assert.
 */
const SIGNATURES: { extension: string; matches: (bytes: Buffer) => boolean }[] = [
  { extension: 'jpg', matches: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  {
    extension: 'png',
    matches: (b) => b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
  },
  {
    extension: 'webp',
    matches: (b) =>
      b.subarray(0, 4).toString('ascii') === 'RIFF' &&
      b.subarray(8, 12).toString('ascii') === 'WEBP',
  },
];

/**
 * Writes one image and returns the path it is served at.
 *
 * The path is returned rather than a full URL: the app knows its own base URL, and baking
 * the host into stored data breaks the moment the server moves.
 */
export async function store(bytes: Buffer): Promise<string> {
  if (bytes.length === 0) throw new ApiError('validation', 'That file is empty');
  if (bytes.length > MAX_UPLOAD_BYTES) {
    throw new ApiError('validation', 'Photos must be under 5MB');
  }

  const signature = SIGNATURES.find((candidate) => candidate.matches(bytes));
  if (!signature) {
    throw new ApiError('validation', 'That is not a JPEG, PNG or WebP image');
  }

  const name = `${randomUUID()}.${signature.extension}`;
  await mkdir(UPLOAD_DIR, { recursive: true });
  await writeFile(path.join(UPLOAD_DIR, name), bytes);

  return `/uploads/${name}`;
}
