/**
 * Venue and court management — the owner's side of onboarding.
 *
 * Until now venues and courts existed only in the seed file, so listing a ground meant an
 * INSERT written by hand. That capped the marketplace at however many grounds someone could
 * personally add, and left owners unable to correct their own prices — which is awkward for
 * a launch whose whole plan is to sign venues onto free tooling before any player arrives.
 *
 * Three rules are enforced here rather than left to the caller:
 *
 *   1. **A new venue is `pending`.** `GET /venues` only ever returns `live` ones, so
 *      self-onboarding cannot put an unchecked ground in front of a player. Someone has to
 *      look at it first.
 *   2. **`from_price_per_hour` is derived, never given.** It is the cheapest court's rate,
 *      recomputed whenever courts change. A hand-set figure is a price that drifts away
 *      from what a player is actually charged.
 *   3. **A court with bookings ahead of it cannot be deleted.** `bookings.court_id` has no
 *      cascade, so the delete would fail on the constraint anyway — but as a foreign key
 *      violation, which reaches the client as a 500 rather than as an explanation.
 */
import { randomUUID } from 'node:crypto';

import { z } from 'zod';

import { pool, tx, type Db } from './db.js';
import { ApiError } from './errors.js';

const SPORTS = ['padel', 'futsal', 'cricket'] as const;
const CITIES = ['lahore', 'karachi', 'islamabad'] as const;

/** `HH:MM`, 24-hour. Grounds here routinely close at 03:00, so the range is not 00:00–23:59. */
const clock = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use a 24-hour time like 18:00');

export const createVenueSchema = z.object({
  name: z.string().trim().min(2).max(80),
  city: z.enum(CITIES),
  area: z.string().trim().min(2).max(60),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  opensAt: clock,
  closesAt: clock,
  phone: z.string().trim().max(20).default(''),
  about: z.string().trim().max(1000).default(''),
  amenities: z.array(z.string().trim().min(1)).max(20).default([]),
  photos: z.array(z.string().url()).max(10).default([]),
});

export const updateVenueSchema = createVenueSchema.partial();

export const createCourtSchema = z.object({
  name: z.string().trim().min(1).max(40),
  sport: z.enum(SPORTS),
  format: z.string().trim().min(1).max(40),
  surface: z.string().trim().max(40).default(''),
  indoor: z.boolean().default(false),
  basePricePerHour: z.number().int().positive().max(1_000_000),
  /**
   * Peak windows, e.g. `[{ from: '18:00', to: '03:00', pricePerHour: 5500 }]`. The window
   * may wrap past midnight — play here runs to 3 AM — so `to` being earlier than `from` is
   * ordinary rather than a mistake.
   */
  peakRules: z
    .array(
      z.object({
        from: clock,
        to: clock,
        pricePerHour: z.number().int().positive(),
        /** 0 = Sunday, matching `Date#getDay`. Empty means every day, which is the usual case. */
        daysOfWeek: z.array(z.number().int().min(0).max(6)).max(7).default([]),
      }),
    )
    .max(6)
    .default([]),
});

export const updateCourtSchema = createCourtSchema.partial();

/**
 * Keeps the venue's headline price and sport list in step with the courts underneath it.
 *
 * Both are denormalised onto `venues` so the discovery list can be one query, which means
 * both are copies — and a copy that is not refreshed is a lie. Adding a cheaper court has
 * to change the "from" price a player sees, and adding a padel court has to make the
 * ground appear under padel.
 */
async function syncVenueFromCourts(db: Db, venueId: string): Promise<void> {
  await db.query(
    `UPDATE venues v
        SET from_price_per_hour = COALESCE(
              (SELECT min(base_price_per_hour) FROM courts WHERE venue_id = v.id),
              v.from_price_per_hour),
            sports = COALESCE(
              (SELECT array_agg(DISTINCT sport ORDER BY sport) FROM courts WHERE venue_id = v.id),
              '{}')
      WHERE v.id = $1`,
    [venueId],
  );
}

export async function createVenue(
  ownerId: string,
  input: z.infer<typeof createVenueSchema>,
): Promise<string> {
  const id = `venue-${randomUUID()}`;

  await pool.query(
    `INSERT INTO venues (
       id, owner_id, name, city, area, latitude, longitude, sports, amenities, photos,
       about, opens_at, closes_at, from_price_per_hour, phone, status
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,'{}',$8,$9,$10,$11,$12,0,$13,'pending')`,
    [
      id,
      ownerId,
      input.name,
      input.city,
      input.area,
      input.latitude,
      input.longitude,
      input.amenities,
      input.photos,
      input.about,
      input.opensAt,
      input.closesAt,
      input.phone,
    ],
  );

  return id;
}

export async function updateVenue(
  venueId: string,
  input: z.infer<typeof updateVenueSchema>,
): Promise<void> {
  // COALESCE per column rather than a built-up SET list: the shape is fixed, so there is no
  // string concatenation anywhere near a query, and an absent field is simply left alone.
  await pool.query(
    `UPDATE venues
        SET name      = COALESCE($2, name),
            city      = COALESCE($3, city),
            area      = COALESCE($4, area),
            latitude  = COALESCE($5, latitude),
            longitude = COALESCE($6, longitude),
            opens_at  = COALESCE($7, opens_at),
            closes_at = COALESCE($8, closes_at),
            phone     = COALESCE($9, phone),
            about     = COALESCE($10, about),
            amenities = COALESCE($11, amenities),
            photos    = COALESCE($12, photos)
      WHERE id = $1`,
    [
      venueId,
      input.name ?? null,
      input.city ?? null,
      input.area ?? null,
      input.latitude ?? null,
      input.longitude ?? null,
      input.opensAt ?? null,
      input.closesAt ?? null,
      input.phone ?? null,
      input.about ?? null,
      input.amenities ?? null,
      input.photos ?? null,
    ],
  );
}

export async function addCourt(
  venueId: string,
  input: z.infer<typeof createCourtSchema>,
): Promise<string> {
  const id = `court-${randomUUID()}`;

  return tx(async (db) => {
    await db.query(
      `INSERT INTO courts (id, venue_id, name, sport, format, surface, indoor,
                           base_price_per_hour, peak_rules)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        id,
        venueId,
        input.name,
        input.sport,
        input.format,
        input.surface,
        input.indoor,
        input.basePricePerHour,
        JSON.stringify(input.peakRules),
      ],
    );
    await syncVenueFromCourts(db, venueId);
    return id;
  });
}

export async function updateCourt(
  courtId: string,
  input: z.infer<typeof updateCourtSchema>,
): Promise<void> {
  await tx(async (db) => {
    const { rows } = await db.query<{ venue_id: string }>(
      `UPDATE courts
          SET name                = COALESCE($2, name),
              sport               = COALESCE($3, sport),
              format              = COALESCE($4, format),
              surface             = COALESCE($5, surface),
              indoor              = COALESCE($6, indoor),
              base_price_per_hour = COALESCE($7, base_price_per_hour),
              peak_rules          = COALESCE($8, peak_rules)
        WHERE id = $1
        RETURNING venue_id`,
      [
        courtId,
        input.name ?? null,
        input.sport ?? null,
        input.format ?? null,
        input.surface ?? null,
        input.indoor ?? null,
        input.basePricePerHour ?? null,
        input.peakRules ? JSON.stringify(input.peakRules) : null,
      ],
    );
    if (rows.length === 0) throw new ApiError('not_found', 'No such court');
    await syncVenueFromCourts(db, rows[0].venue_id);
  });
}

/**
 * Removes a court, unless people are booked onto it.
 *
 * The check is for bookings still ahead of us. Past ones are history the venue's earnings
 * are built from and must survive; a court with a game on it tomorrow cannot vanish, or
 * whoever booked it turns up to a ground that no longer thinks the court exists.
 */
export async function deleteCourt(courtId: string): Promise<void> {
  await tx(async (db) => {
    const { rows: courts } = await db.query<{ venue_id: string }>(
      'SELECT venue_id FROM courts WHERE id = $1',
      [courtId],
    );
    if (courts.length === 0) throw new ApiError('not_found', 'No such court');

    const { rows: upcoming } = await db.query<{ count: string }>(
      `SELECT count(*) AS count FROM bookings
        WHERE court_id = $1 AND status <> 'cancelled' AND start_at > now()`,
      [courtId],
    );
    if (Number(upcoming[0].count) > 0) {
      throw new ApiError(
        'validation',
        'This court has upcoming bookings. Cancel them before removing it.',
      );
    }

    // Past bookings keep the reference, so the row cannot go. Blocking it off is honest:
    // the court stops being bookable and the earnings history stays intact.
    const { rows: past } = await db.query<{ count: string }>(
      'SELECT count(*) AS count FROM bookings WHERE court_id = $1',
      [courtId],
    );
    if (Number(past[0].count) > 0) {
      throw new ApiError(
        'validation',
        'This court has bookings in its history, so it cannot be deleted. Set its price to hide it instead.',
      );
    }

    await db.query('DELETE FROM courts WHERE id = $1', [courtId]);
    await syncVenueFromCourts(db, courts[0].venue_id);
  });
}
