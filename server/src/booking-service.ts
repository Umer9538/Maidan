/**
 * Slots, holds and bookings — the two things docs/05 §1 says must never break.
 *
 * Pricing comes from the app's own `resolveSlotPrice` and `calculatePayment`, imported
 * rather than reimplemented: a slot priced one way on the phone and another on the server
 * is an argument with a customer, and the only way to guarantee they agree is to run the
 * same code.
 */
import { randomUUID } from 'node:crypto';

import type { Booking, PaymentMode, PaymentProvider, Slot } from '@/domain/types';
import { toPkt } from '@/lib/datetime';
import { calculatePayment, resolveSlotPrice } from '@/lib/pricing';

import { PG, isPgError, pool, tx, type Db } from './db.js';
import { ApiError } from './errors.js';
import { toBooking, toCourt } from './mappers.js';

/** Mirrors the client's hold window. docs/05 §5.1. */
export const HOLD_TTL_MS = 5 * 60 * 1000;

const SLOT_MINUTES = 60;
const FIRST_SLOT_HOUR = 9;
const SLOT_COUNT = 17;

/** Six characters, no ambiguous glyphs — this gets read aloud at a counter. */
function bookingCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from(
    { length: 6 },
    () => alphabet[Math.floor(Math.random() * alphabet.length)],
  ).join('');
}

/** Expired holds are swept before every read, so a stale row never blocks a live slot. */
async function sweepHolds(db: Db | typeof pool): Promise<void> {
  await db.query('DELETE FROM slot_holds WHERE expires_at <= now()');
}

async function loadCourt(courtId: string) {
  const { rows } = await pool.query('SELECT * FROM courts WHERE id = $1', [courtId]);
  if (rows.length === 0) throw new ApiError('not_found', `No court ${courtId}`);
  return toCourt(rows[0]);
}

export async function listSlots(courtId: string, dayIso: string): Promise<Slot[]> {
  await sweepHolds(pool);
  const court = await loadCourt(courtId);
  const day = toPkt(dayIso);

  const slots: Slot[] = Array.from({ length: SLOT_COUNT }, (_, index) => {
    const hour = FIRST_SLOT_HOUR + index;
    // PKT is UTC+5; building in UTC keeps this free of server-timezone drift.
    const start = new Date(Date.UTC(day.year, day.month - 1, day.day, hour - 5, 0, 0));
    const end = new Date(start.getTime() + SLOT_MINUTES * 60_000);
    const startAt = start.toISOString();
    const { price, isPeak } = resolveSlotPrice(court, startAt);
    return { courtId, startAt, endAt: end.toISOString(), price, status: 'available', isPeak };
  });

  const range = { from: slots[0].startAt, to: slots[slots.length - 1].endAt };

  const [{ rows: booked }, { rows: held }] = await Promise.all([
    pool.query(
      `SELECT start_at FROM bookings
        WHERE court_id = $1 AND status <> 'cancelled' AND start_at >= $2 AND start_at < $3`,
      [courtId, range.from, range.to],
    ),
    pool.query(
      `SELECT start_at FROM slot_holds
        WHERE court_id = $1 AND expires_at > now() AND start_at >= $2 AND start_at < $3`,
      [courtId, range.from, range.to],
    ),
  ]);

  const bookedAt = new Set(booked.map((row) => row.start_at.toISOString()));
  const heldAt = new Set(held.map((row) => row.start_at.toISOString()));
  const now = Date.now();

  return slots.map((slot) => {
    if (bookedAt.has(slot.startAt)) return { ...slot, status: 'booked' };
    if (heldAt.has(slot.startAt)) return { ...slot, status: 'held' };
    if (new Date(slot.startAt).getTime() < now) return { ...slot, status: 'blocked' };
    return slot;
  });
}

export interface SlotHold {
  id: string;
  courtId: string;
  startAt: string;
  endAt: string;
  expiresAt: string;
}

export async function holdSlot(courtId: string, startAt: string): Promise<SlotHold> {
  await sweepHolds(pool);

  const taken = await pool.query(
    `SELECT 1 FROM bookings
      WHERE court_id = $1 AND status <> 'cancelled' AND start_at = $2`,
    [courtId, startAt],
  );
  if (taken.rowCount) throw new ApiError('slot_taken', 'That slot has just been booked.');

  const id = `hold-${randomUUID()}`;
  const endAt = new Date(new Date(startAt).getTime() + SLOT_MINUTES * 60_000).toISOString();
  const expiresAt = new Date(Date.now() + HOLD_TTL_MS).toISOString();

  try {
    await pool.query(
      `INSERT INTO slot_holds (id, court_id, start_at, end_at, expires_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [id, courtId, startAt, endAt, expiresAt],
    );
  } catch (error) {
    // The unique index is what makes two players racing for one slot safe.
    if (isPgError(error, PG.UNIQUE_VIOLATION)) {
      throw new ApiError('slot_taken', 'Another player is checking out for that slot.');
    }
    throw error;
  }

  return { id, courtId, startAt, endAt, expiresAt };
}

export async function releaseHold(holdId: string): Promise<void> {
  await pool.query('DELETE FROM slot_holds WHERE id = $1', [holdId]);
}

export interface CreateBookingInput {
  intentId: string;
  holdId: string;
  paymentMode: PaymentMode;
  provider: PaymentProvider;
  userId: string;
}

export async function createBooking(input: CreateBookingInput): Promise<Booking> {
  // Idempotency first: a retry must return the original booking, never a second one.
  const existing = await pool.query('SELECT * FROM bookings WHERE intent_id = $1', [
    input.intentId,
  ]);
  if (existing.rowCount) return toBooking(existing.rows[0]);

  return tx(async (db) => {
    await sweepHolds(db);

    // Locked so a concurrent redemption of the same hold cannot slip past.
    const { rows: holds } = await db.query(
      'SELECT * FROM slot_holds WHERE id = $1 FOR UPDATE',
      [input.holdId],
    );
    if (holds.length === 0) throw new ApiError('hold_expired', 'Your slot hold has expired.');

    const hold = holds[0];
    if (new Date(hold.expires_at).getTime() <= Date.now()) {
      throw new ApiError('hold_expired', 'Your slot hold has expired.');
    }

    const court = toCourt(
      (await db.query('SELECT * FROM courts WHERE id = $1', [hold.court_id])).rows[0],
    );
    const { price } = resolveSlotPrice(court, hold.start_at.toISOString());
    const breakdown = calculatePayment(price, input.paymentMode);

    const { rows: policies } = await db.query(
      "SELECT tiers, id, label FROM cancellation_policies WHERE id = 'standard'",
    );
    const policy = policies[0] ?? { id: 'standard', label: 'Standard', tiers: [] };

    const id = `booking-${randomUUID()}`;
    let inserted;
    try {
      inserted = await db.query(
        `INSERT INTO bookings (
           id, intent_id, court_id, venue_id, user_id, start_at, end_at, status,
           total, paid_online, due_at_venue, payment_mode, provider, source,
           cancellation_policy, code
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,'confirmed',$8,$9,$10,$11,$12,'app',$13,$14)
         RETURNING *`,
        [
          id,
          input.intentId,
          court.id,
          court.venueId,
          input.userId,
          hold.start_at,
          hold.end_at,
          breakdown.total,
          breakdown.payNow,
          breakdown.dueAtVenue,
          input.paymentMode,
          input.provider,
          JSON.stringify(policy),
          bookingCode(),
        ],
      );
    } catch (error) {
      // The exclusion constraint is the final referee, whatever the checks above saw.
      if (isPgError(error, PG.EXCLUSION_VIOLATION)) {
        throw new ApiError('slot_taken', 'That slot has just been booked.');
      }
      // Two retries landing at once: the loser reads the winner's row.
      if (isPgError(error, PG.UNIQUE_VIOLATION)) {
        const replay = await db.query('SELECT * FROM bookings WHERE intent_id = $1', [
          input.intentId,
        ]);
        if (replay.rowCount) return toBooking(replay.rows[0]);
      }
      throw error;
    }

    await db.query('DELETE FROM slot_holds WHERE id = $1', [input.holdId]);
    return toBooking(inserted.rows[0]);
  });
}

export interface ManualBookingInput {
  courtId: string;
  startAt: string;
  customerName: string;
  customerPhone: string;
  price?: number;
  ownerId: string;
}

export async function createManualBooking(input: ManualBookingInput): Promise<Booking> {
  return tx(async (db) => {
    await sweepHolds(db);

    const held = await db.query(
      'SELECT 1 FROM slot_holds WHERE court_id = $1 AND start_at = $2 AND expires_at > now()',
      [input.courtId, input.startAt],
    );
    if (held.rowCount) {
      throw new ApiError('slot_taken', 'A player is checking out for that slot right now.');
    }

    const court = toCourt(
      (await db.query('SELECT * FROM courts WHERE id = $1', [input.courtId])).rows[0],
    );
    const { price } = resolveSlotPrice(court, input.startAt);
    const total = input.price ?? price;
    const endAt = new Date(new Date(input.startAt).getTime() + SLOT_MINUTES * 60_000).toISOString();

    const { rows: policies } = await db.query(
      "SELECT tiers, id, label FROM cancellation_policies WHERE id = 'standard'",
    );
    const policy = policies[0] ?? { id: 'standard', label: 'Standard', tiers: [] };

    try {
      const { rows } = await db.query(
        `INSERT INTO bookings (
           id, intent_id, court_id, venue_id, user_id, start_at, end_at, status,
           total, paid_online, due_at_venue, payment_mode, provider, source,
           cancellation_policy, code, customer_name, customer_phone
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,'confirmed',$8,0,$8,'deposit',NULL,'manual',$9,$10,$11,$12)
         RETURNING *`,
        [
          `booking-${randomUUID()}`,
          `manual-${randomUUID()}`,
          court.id,
          court.venueId,
          input.ownerId,
          input.startAt,
          endAt,
          total,
          JSON.stringify(policy),
          bookingCode(),
          input.customerName.trim(),
          input.customerPhone.trim(),
        ],
      );
      return toBooking(rows[0]);
    } catch (error) {
      // A walk-in faces the same referee as an app booking. One source of truth.
      if (isPgError(error, PG.EXCLUSION_VIOLATION)) {
        throw new ApiError('slot_taken', 'That slot is already booked.');
      }
      throw error;
    }
  });
}
