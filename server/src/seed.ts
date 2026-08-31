/**
 * Loads the database from the app's own seed module.
 *
 * Importing `@/data/seed` rather than restating the data means the HTTP backend and the
 * in-memory mock hold identical records — so switching between them changes the transport
 * and nothing a tester would notice. Re-runnable: every insert upserts.
 */
import * as seed from '@/data/seed';

import { pool } from './db.js';

/** Venues reference owners the player list does not carry; they are created as needed. */
function ownerPlaceholder(ownerId: string) {
  const label = ownerId
    .replace(/^owner-/, '')
    .replace(/(^|-)(\w)/g, (_, dash, letter) => (dash ? ' ' : '') + letter.toUpperCase());
  return { id: ownerId, name: `${label} (venue owner)`, avatarUrl: null };
}

async function main() {
  const now = new Date();

  console.log('clearing…');
  await pool.query(`
    TRUNCATE reviews, notifications, messages, thread_members, chat_threads,
             match_players, open_matches, challenges, team_members, teams,
             payment_events, slot_holds, bookings, courts, venues, players,
             cancellation_policies
    RESTART IDENTITY CASCADE
  `);

  await pool.query(
    'INSERT INTO cancellation_policies (id, label, tiers) VALUES ($1,$2,$3)',
    [seed.STANDARD_POLICY.id, seed.STANDARD_POLICY.label, JSON.stringify(seed.STANDARD_POLICY.tiers)],
  );

  console.log(`players: ${seed.players.length}`);
  const ownerIds = new Set(seed.venues.map((venue) => venue.ownerId));
  const known = new Set(seed.players.map((player) => player.id));
  const extraOwners = [...ownerIds].filter((id) => !known.has(id)).map(ownerPlaceholder);

  for (const player of [...seed.players, ...extraOwners]) {
    await pool.query(
      `INSERT INTO players (id, full_name, avatar_url, reliability, games_played, skill_by_sport, phone)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [
        player.id,
        player.name,
        player.avatarUrl,
        'reliability' in player ? player.reliability : 100,
        'gamesPlayed' in player ? player.gamesPlayed : 0,
        JSON.stringify('skillBySport' in player ? player.skillBySport : {}),
        player.id === seed.CURRENT_USER_ID ? '+923001234567' : '',
      ],
    );
  }

  console.log(`venues: ${seed.venues.length}`);
  for (const venue of seed.venues) {
    await pool.query(
      `INSERT INTO venues (
         id, owner_id, name, city, area, latitude, longitude, sports, amenities, photos,
         about, opens_at, closes_at, from_price_per_hour, phone, rating, review_count,
         player_count, status
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)`,
      [
        venue.id,
        venue.ownerId,
        venue.name,
        venue.city,
        venue.area,
        venue.geo.latitude,
        venue.geo.longitude,
        venue.sports,
        venue.amenities,
        venue.photos,
        venue.about,
        venue.hours.opensAt,
        venue.hours.closesAt,
        venue.fromPricePerHour,
        venue.phone,
        venue.rating,
        venue.reviewCount,
        venue.playerCount,
        venue.status,
      ],
    );
  }

  console.log(`courts: ${seed.courts.length}`);
  for (const court of seed.courts) {
    await pool.query(
      `INSERT INTO courts (id, venue_id, name, sport, format, surface, indoor, base_price_per_hour, peak_rules)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        court.id,
        court.venueId,
        court.name,
        court.sport,
        court.format,
        court.surface,
        court.indoor,
        court.basePricePerHour,
        JSON.stringify(court.peakRules),
      ],
    );
  }

  const bookings = seed.exampleBookings(now);
  console.log(`bookings: ${bookings.length}`);
  for (const booking of bookings) {
    await pool.query(
      `INSERT INTO bookings (
         id, intent_id, court_id, venue_id, user_id, start_at, end_at, status, total,
         paid_online, due_at_venue, payment_mode, provider, source, cancellation_policy, code
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
      [
        booking.id,
        booking.intentId,
        booking.courtId,
        booking.venueId,
        booking.userId,
        booking.startAt,
        booking.endAt,
        booking.status,
        booking.total,
        booking.paidOnline,
        booking.dueAtVenue,
        booking.paymentMode,
        booking.provider,
        booking.source,
        JSON.stringify(booking.cancellationPolicy),
        booking.code,
      ],
    );
  }

  console.log(`teams: ${seed.teams.length}`);
  for (const team of seed.teams) {
    await pool.query(
      `INSERT INTO teams (id, name, sport, city, crest_url, captain_id, wins, losses, city_rank)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        team.id,
        team.name,
        team.sport,
        team.city,
        team.crestUrl,
        team.captainId,
        team.wins,
        team.losses,
        team.cityRank,
      ],
    );
    for (const memberId of team.memberIds) {
      await pool.query(
        'INSERT INTO team_members (team_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING',
        [team.id, memberId],
      );
    }
  }

  console.log(`challenges: ${seed.challenges.length}`);
  for (const challenge of seed.challenges) {
    await pool.query(
      `INSERT INTO challenges (
         id, type, challenger_team_id, opponent_team_id, sport, format, area,
         proposed_start_at, stake, status, reported_scores
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [
        challenge.id,
        challenge.type,
        challenge.challengerTeamId,
        challenge.opponentTeamId,
        challenge.sport,
        challenge.format,
        challenge.area,
        challenge.proposedStartAt,
        challenge.stake,
        challenge.status,
        JSON.stringify(challenge.reportedScores),
      ],
    );
  }

  /*
   * Open matches need a booking each, because a match is a slot someone has paid to hold.
   * The seed's matches reference booking ids that do not exist, so a holding booking is
   * created for each — which is exactly the shape the real flow produces.
   */
  console.log(`open matches: ${seed.openMatches.length}`);
  for (const match of seed.openMatches) {
    const holdingBookingId = `booking-for-${match.id}`;
    const endAt = new Date(new Date(match.startAt).getTime() + 3_600_000).toISOString();
    const total = match.pricePerPlayer * match.playersNeeded;

    await pool.query(
      `INSERT INTO bookings (
         id, intent_id, court_id, venue_id, user_id, start_at, end_at, status, total,
         paid_online, due_at_venue, payment_mode, provider, source, cancellation_policy, code
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,'confirmed',$8,$9,$10,'deposit','jazzcash','app',$11,$12)
       ON CONFLICT DO NOTHING`,
      [
        holdingBookingId,
        `intent-${match.id}`,
        match.courtId,
        match.venueId,
        match.hostId,
        match.startAt,
        endAt,
        total,
        Math.round(total * 0.2),
        total - Math.round(total * 0.2),
        JSON.stringify(seed.STANDARD_POLICY),
        match.id.toUpperCase().slice(0, 6).padEnd(6, 'X'),
      ],
    );

    await pool.query(
      `INSERT INTO open_matches (
         id, booking_id, host_id, venue_id, court_id, sport, format, start_at,
         players_needed, players_joined, skill_level, gender_preference,
         price_per_player, note, instant_join, status
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
      [
        match.id,
        holdingBookingId,
        match.hostId,
        match.venueId,
        match.courtId,
        match.sport,
        match.format,
        match.startAt,
        match.playersNeeded,
        match.playersJoined,
        match.skillLevel,
        match.genderPreference,
        match.pricePerPlayer,
        match.note,
        match.instantJoin,
        match.status,
      ],
    );
    await pool.query(
      `INSERT INTO match_players (match_id, user_id, status) VALUES ($1,$2,'approved')
       ON CONFLICT DO NOTHING`,
      [match.id, match.hostId],
    );
  }

  console.log(`threads: ${seed.chatThreads.length}`);
  for (const thread of seed.chatThreads) {
    await pool.query(
      `INSERT INTO chat_threads (id, kind, title, subtitle, avatar_url, venue_id, last_message, last_message_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        thread.id,
        thread.kind,
        thread.title,
        thread.subtitle,
        thread.avatarUrl,
        thread.venueId,
        thread.lastMessage,
        thread.lastMessageAt,
      ],
    );
    for (const memberId of thread.memberIds) {
      await pool.query(
        'INSERT INTO thread_members (thread_id, user_id, unread) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING',
        [thread.id, memberId, memberId === seed.CURRENT_USER_ID ? thread.unreadCount : 0],
      );
    }
  }

  console.log(`messages: ${seed.messages.length}`);
  for (const message of seed.messages) {
    await pool.query(
      'INSERT INTO messages (id, thread_id, author_id, body, sent_at) VALUES ($1,$2,$3,$4,$5)',
      [message.id, message.threadId, message.authorId, message.body, message.sentAt],
    );
  }

  /*
   * Reviews cite a booking, which is what makes them verified. The seeded ones belong to
   * other players, so each gets a completed booking of its own.
   */
  console.log(`reviews: ${seed.reviews.length}`);
  for (const review of seed.reviews) {
    const court = seed.courts.find((each) => each.venueId === review.venueId);
    if (!court) continue;

    const start = new Date(new Date(review.createdAt).getTime() - 2 * 3_600_000);
    await pool.query(
      `INSERT INTO bookings (
         id, intent_id, court_id, venue_id, user_id, start_at, end_at, status, total,
         paid_online, due_at_venue, payment_mode, provider, source, cancellation_policy, code
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,'completed',$8,$8,0,'full_prepay','card','app',$9,$10)
       ON CONFLICT DO NOTHING`,
      [
        review.bookingId,
        `intent-${review.bookingId}`,
        court.id,
        review.venueId,
        review.authorId,
        start.toISOString(),
        new Date(start.getTime() + 3_600_000).toISOString(),
        court.basePricePerHour,
        JSON.stringify(seed.STANDARD_POLICY),
        review.id.toUpperCase().slice(0, 6).padEnd(6, 'X'),
      ],
    );
    await pool.query(
      'INSERT INTO reviews (id, venue_id, booking_id, author_id, rating, body, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7)',
      [
        review.id,
        review.venueId,
        review.bookingId,
        review.authorId,
        review.rating,
        review.body,
        review.createdAt,
      ],
    );
  }

  console.log(`notifications: ${seed.notifications.length}`);
  for (const notification of seed.notifications) {
    await pool.query(
      `INSERT INTO notifications (id, user_id, kind, actor_name, actor_avatar, body, target_id, read, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        notification.id,
        seed.CURRENT_USER_ID,
        notification.kind,
        notification.actorName,
        notification.actorAvatarUrl,
        notification.body,
        notification.decision?.targetId ?? null,
        notification.read,
        notification.createdAt,
      ],
    );
  }

  console.log('done');
  await pool.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
