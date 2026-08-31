import { ApiError } from '../api';
import { HOLD_TTL_MS, createMockApi } from '../mock-api';

/** A clock the test drives, so hold expiry is exercised without waiting five minutes. */
function fakeClock(start: string) {
  let current = new Date(start);
  return {
    now: () => current,
    advance(ms: number) {
      current = new Date(current.getTime() + ms);
    },
  };
}

const DAY = '2026-09-02T10:00:00+05:00';
const COURT = 'court-pr-1';

/**
 * Picks an evening slot rather than merely the first available one: tests that advance the
 * clock would otherwise watch their slot slide into the past and be reported as `blocked`.
 */
async function firstAvailableSlot(api: ReturnType<typeof createMockApi>) {
  const slots = await api.listSlots(COURT, DAY);
  const slot = slots.find(
    (candidate) => candidate.status === 'available' && candidate.startAt.endsWith('16:00:00.000Z'),
  );
  if (!slot) throw new Error('seed produced no available evening slot');
  return slot;
}

describe('slot listing', () => {
  it('prices peak and off-peak from the court rules', async () => {
    const api = createMockApi(() => new Date(DAY));
    const slots = await api.listSlots(COURT, DAY);

    const offPeak = slots.find((slot) => slot.startAt.endsWith('06:00:00.000Z')); // 11 AM PKT
    const peak = slots.find((slot) => slot.startAt.endsWith('16:00:00.000Z')); // 9 PM PKT

    expect(offPeak).toMatchObject({ price: 4500, isPeak: false });
    expect(peak).toMatchObject({ price: 5500, isPeak: true });
  });

  it('blocks slots that have already started', async () => {
    const api = createMockApi(() => new Date('2026-09-02T20:00:00+05:00'));
    const slots = await api.listSlots(COURT, DAY);
    const morning = slots.find((slot) => slot.startAt.endsWith('06:00:00.000Z'));
    expect(morning?.status).toBe('blocked');
  });
});

describe('slot holds', () => {
  it('shows a held slot as held to everyone else', async () => {
    const clock = fakeClock(DAY);
    const api = createMockApi(clock.now);
    const slot = await firstAvailableSlot(api);

    await api.holdSlot(COURT, slot.startAt);

    const after = await api.listSlots(COURT, DAY);
    expect(after.find((candidate) => candidate.startAt === slot.startAt)?.status).toBe('held');
  });

  it('refuses a second hold on the same slot', async () => {
    const api = createMockApi(() => new Date(DAY));
    const slot = await firstAvailableSlot(api);

    await api.holdSlot(COURT, slot.startAt);
    await expect(api.holdSlot(COURT, slot.startAt)).rejects.toMatchObject({ code: 'slot_taken' });
  });

  it('lets the slot go once the hold expires', async () => {
    const clock = fakeClock(DAY);
    const api = createMockApi(clock.now);
    const slot = await firstAvailableSlot(api);

    await api.holdSlot(COURT, slot.startAt);
    clock.advance(HOLD_TTL_MS + 1000);

    const after = await api.listSlots(COURT, DAY);
    expect(after.find((candidate) => candidate.startAt === slot.startAt)?.status).toBe('available');
    await expect(api.holdSlot(COURT, slot.startAt)).resolves.toBeDefined();
  });

  it('releases a hold on request, so backing out of checkout frees the slot', async () => {
    const api = createMockApi(() => new Date(DAY));
    const slot = await firstAvailableSlot(api);

    const hold = await api.holdSlot(COURT, slot.startAt);
    await api.releaseHold(hold.id);

    const after = await api.listSlots(COURT, DAY);
    expect(after.find((candidate) => candidate.startAt === slot.startAt)?.status).toBe('available');
  });
});

describe('booking', () => {
  it('creates a confirmed booking and marks the slot booked', async () => {
    const api = createMockApi(() => new Date(DAY));
    const slot = await firstAvailableSlot(api);
    const hold = await api.holdSlot(COURT, slot.startAt);

    const booking = await api.createBooking({
      intentId: 'intent-1',
      holdId: hold.id,
      paymentMode: 'deposit',
      provider: 'jazzcash',
    });

    expect(booking.status).toBe('confirmed');
    expect(booking.code).toMatch(/^[A-Z2-9]{6}$/);

    const after = await api.listSlots(COURT, DAY);
    expect(after.find((candidate) => candidate.startAt === slot.startAt)?.status).toBe('booked');
  });

  it('splits a deposit booking into an online leg and cash at the counter', async () => {
    const api = createMockApi(() => new Date(DAY));
    const slots = await api.listSlots(COURT, DAY);
    const peak = slots.find((slot) => slot.price === 5500 && slot.status === 'available');
    const hold = await api.holdSlot(COURT, peak!.startAt);

    const booking = await api.createBooking({
      intentId: 'intent-peak',
      holdId: hold.id,
      paymentMode: 'deposit',
      provider: 'jazzcash',
    });

    expect(booking.dueAtVenue).toBe(4400);
    expect(booking.paidOnline).toBe(1200); // Rs 1,100 deposit + Rs 100 convenience fee
    expect(booking.paidOnline + booking.dueAtVenue).toBe(booking.total);
  });

  it('is idempotent: replaying an intent returns the original booking, not a second one', async () => {
    const api = createMockApi(() => new Date(DAY));
    const slot = await firstAvailableSlot(api);
    const hold = await api.holdSlot(COURT, slot.startAt);

    const input = {
      intentId: 'intent-retry',
      holdId: hold.id,
      paymentMode: 'deposit' as const,
      provider: 'jazzcash' as const,
    };

    const first = await api.createBooking(input);
    const retry = await api.createBooking(input);

    expect(retry.id).toBe(first.id);
    expect(retry.code).toBe(first.code);
    expect(await api.listBookings()).toHaveLength(1);
  });

  it('rejects a booking whose hold has expired', async () => {
    const clock = fakeClock(DAY);
    const api = createMockApi(clock.now);
    const slot = await firstAvailableSlot(api);
    const hold = await api.holdSlot(COURT, slot.startAt);

    clock.advance(HOLD_TTL_MS + 1000);

    await expect(
      api.createBooking({
        intentId: 'intent-late',
        holdId: hold.id,
        paymentMode: 'deposit',
        provider: 'jazzcash',
      }),
    ).rejects.toMatchObject({ code: 'hold_expired' });
  });

  it('rejects an unknown hold', async () => {
    const api = createMockApi(() => new Date(DAY));
    await expect(
      api.createBooking({
        intentId: 'intent-bogus',
        holdId: 'hold-does-not-exist',
        paymentMode: 'full_prepay',
        provider: 'card',
      }),
    ).rejects.toBeInstanceOf(ApiError);
  });

  it('never double-books a slot, even across two separate holds', async () => {
    const api = createMockApi(() => new Date(DAY));
    const slot = await firstAvailableSlot(api);

    const hold = await api.holdSlot(COURT, slot.startAt);
    await api.createBooking({
      intentId: 'intent-a',
      holdId: hold.id,
      paymentMode: 'deposit',
      provider: 'jazzcash',
    });

    await expect(api.holdSlot(COURT, slot.startAt)).rejects.toMatchObject({ code: 'slot_taken' });
  });
});

describe('open matches', () => {
  it('fills up and then refuses further joins', async () => {
    const api = createMockApi(() => new Date(DAY));
    const [match] = await api.listOpenMatches({ sport: 'padel' });
    const remaining = match.playersNeeded - match.playersJoined;

    for (let i = 0; i < remaining; i += 1) {
      await api.requestToJoinMatch(match.id);
    }

    const full = await api.getOpenMatch(match.id);
    expect(full.status).toBe('full');
    await expect(api.requestToJoinMatch(match.id)).rejects.toMatchObject({ code: 'slot_taken' });
  });

  it('drops a full match out of the open feed', async () => {
    const api = createMockApi(() => new Date(DAY));
    const [match] = await api.listOpenMatches();
    const remaining = match.playersNeeded - match.playersJoined;
    for (let i = 0; i < remaining; i += 1) await api.requestToJoinMatch(match.id);

    const feed = await api.listOpenMatches();
    expect(feed.map((candidate) => candidate.id)).not.toContain(match.id);
  });
});

describe('chat', () => {
  it('appends a sent message and moves the thread to the top', async () => {
    const api = createMockApi(() => new Date('2026-09-03T12:00:00+05:00'));
    await api.sendMessage('thread-strikers', 'Rematch on Sunday?');

    const threads = await api.listThreads();
    expect(threads[0].id).toBe('thread-strikers');
    expect(threads[0].lastMessage).toBe('Rematch on Sunday?');

    const messages = await api.listMessages('thread-strikers');
    expect(messages.at(-1)).toMatchObject({ body: 'Rematch on Sunday?', mine: true });
  });
});

describe('my matches', () => {
  it('starts empty and remembers what the player joined', async () => {
    const api = createMockApi(() => new Date(DAY));
    expect(await api.listMyMatches()).toHaveLength(0);

    const [match] = await api.listOpenMatches();
    await api.requestToJoinMatch(match.id);

    expect((await api.listMyMatches()).map((each) => each.id)).toEqual([match.id]);
  });

  it('keeps a joined match after it fills up, so it stays on the schedule', async () => {
    const api = createMockApi(() => new Date(DAY));
    const [match] = await api.listOpenMatches();
    const remaining = match.playersNeeded - match.playersJoined;
    for (let i = 0; i < remaining; i += 1) await api.requestToJoinMatch(match.id);

    // It has dropped out of the open feed but not out of the player's own list.
    expect((await api.listOpenMatches()).map((each) => each.id)).not.toContain(match.id);
    expect((await api.listMyMatches()).map((each) => each.id)).toContain(match.id);
  });
});

describe('reviews', () => {
  async function bookingIn(status: 'confirmed' | 'completed') {
    const api = createMockApi({ now: () => new Date(DAY), latencyMs: 0, seedBookings: true });
    const bookings = await api.listBookings();
    const booking = bookings.find((each) => each.status === status);
    if (!booking) throw new Error(`seed has no ${status} booking`);
    return { api, booking };
  }

  it('accepts a review for a booking that was played', async () => {
    const { api, booking } = await bookingIn('completed');

    const review = await api.submitReview({ bookingId: booking.id, rating: 5, body: 'Great turf' });

    expect(review.venueId).toBe(booking.venueId);
    expect(review.bookingId).toBe(booking.id);
    expect((await api.listReviews(booking.venueId)).map((each) => each.id)).toContain(review.id);
  });

  it('refuses a review for a booking that has not been played', async () => {
    const { api, booking } = await bookingIn('confirmed');

    await expect(
      api.submitReview({ bookingId: booking.id, rating: 5, body: 'Looks nice' }),
    ).rejects.toMatchObject({ code: 'not_played' });
  });

  it('refuses a second review for the same booking', async () => {
    const { api, booking } = await bookingIn('completed');
    await api.submitReview({ bookingId: booking.id, rating: 4, body: 'Good' });

    await expect(
      api.submitReview({ bookingId: booking.id, rating: 1, body: 'Changed my mind' }),
    ).rejects.toMatchObject({ code: 'already_reviewed' });
  });

  it('clamps a rating into the 1 to 5 range rather than storing nonsense', async () => {
    const { api, booking } = await bookingIn('completed');
    const review = await api.submitReview({ bookingId: booking.id, rating: 9, body: 'Ten stars' });
    expect(review.rating).toBe(5);
  });
});

describe('searchPlayers', () => {
  it('returns everyone but the current player when the query is empty', async () => {
    const api = createMockApi({ now: () => new Date(DAY), latencyMs: 0 });
    const players = await api.searchPlayers('');
    expect(players.length).toBeGreaterThan(0);
    expect(players.map((each) => each.id)).not.toContain('player-self');
  });

  it('matches on a name fragment, case-insensitively', async () => {
    const api = createMockApi({ now: () => new Date(DAY), latencyMs: 0 });
    expect((await api.searchPlayers('sara')).map((each) => each.name)).toEqual(['Sara Khan']);
  });
});

describe('opening a match', () => {
  /** Named rather than "the first confirmed one" — the seed has several sports. */
  async function upcoming(bookingId = 'booking-seed-upcoming') {
    const api = createMockApi({ now: () => new Date(DAY), latencyMs: 0, seedBookings: true });
    const booking = (await api.listBookings()).find((each) => each.id === bookingId);
    if (!booking) throw new Error(`seed has no booking ${bookingId}`);
    return { api, booking };
  }

  it('opens a booking to other players and puts it in the feed', async () => {
    const { api, booking } = await upcoming();

    const match = await api.createOpenMatch({
      bookingId: booking.id,
      format: 'padel_doubles',
      playersNeeded: 4,
      playersJoined: 1,
      skillLevel: 'intermediate',
      genderPreference: 'anyone',
      note: null,
      instantJoin: true,
    });

    expect(match.bookingId).toBe(booking.id);
    // The sport comes from the court, never from the form.
    expect(match.sport).toBe('padel');
    expect(match.startAt).toBe(booking.startAt);
    expect((await api.listOpenMatches()).map((each) => each.id)).toContain(match.id);
  });

  it('derives the per-player price from what the booking actually cost', async () => {
    const { api, booking } = await upcoming();

    const match = await api.createOpenMatch({
      bookingId: booking.id,
      format: 'padel_doubles',
      playersNeeded: 4,
      playersJoined: 1,
      skillLevel: 'intermediate',
      genderPreference: 'anyone',
      note: null,
      instantJoin: true,
    });

    // Rounded up, so four shares always cover the slot.
    expect(match.pricePerPlayer).toBe(Math.ceil(booking.total / 4));
    expect(match.pricePerPlayer * 4).toBeGreaterThanOrEqual(booking.total);
  });

  it('takes the sport from the court for cricket too, not from the format picked', async () => {
    const { api, booking } = await upcoming('booking-seed-cricket');

    const match = await api.createOpenMatch({
      bookingId: booking.id,
      format: 'cricket_tape_ball',
      playersNeeded: 16,
      playersJoined: 6,
      skillLevel: 'beginner',
      genderPreference: 'men',
      note: '8 a side, 6 overs.',
      instantJoin: true,
    });

    expect(match.sport).toBe('cricket');
    expect(match.format).toBe('cricket_tape_ball');
    // Tape-ball runs 8 a side, so a 16-way split of a Rs 1,900 cage.
    expect(match.pricePerPlayer).toBe(Math.ceil(booking.total / 16));
    expect(match.genderPreference).toBe('men');
  });

  it('refuses to open the same booking twice', async () => {
    const { api, booking } = await upcoming();
    const input = {
      bookingId: booking.id,
      format: 'padel_doubles' as const,
      playersNeeded: 4,
      playersJoined: 1,
      skillLevel: 'intermediate' as const,
      genderPreference: 'anyone' as const,
      note: null,
      instantJoin: true,
    };
    await api.createOpenMatch(input);

    await expect(api.createOpenMatch(input)).rejects.toMatchObject({ code: 'already_open' });
  });

  it('opens as full when the host says everyone is already in', async () => {
    const { api, booking } = await upcoming();

    const match = await api.createOpenMatch({
      bookingId: booking.id,
      format: 'padel_doubles',
      playersNeeded: 4,
      playersJoined: 4,
      skillLevel: 'intermediate',
      genderPreference: 'anyone',
      note: null,
      instantJoin: true,
    });

    expect(match.status).toBe('full');
    expect((await api.listOpenMatches()).map((each) => each.id)).not.toContain(match.id);
  });
});

describe('challenges', () => {
  const api = () => createMockApi({ now: () => new Date(DAY), latencyMs: 0 });

  it('posts an open challenge to the board', async () => {
    const client = api();
    const challenge = await client.createChallenge({
      challengerTeamId: 'team-my-team',
      opponentTeamId: null,
      format: 'futsal_5v5',
      area: 'Johar Town',
      proposedStartAt: '2026-09-05T16:00:00.000Z',
      stake: 'split_cost',
    });

    expect(challenge.type).toBe('open');
    expect(challenge.status).toBe('open');
    expect((await client.listChallenges()).map((each) => each.id)).toContain(challenge.id);
  });

  it('aims a direct challenge at one team and skips the board', async () => {
    const client = api();
    const challenge = await client.createChallenge({
      challengerTeamId: 'team-my-team',
      opponentTeamId: 'team-dha-strikers',
      format: 'futsal_7v7',
      area: 'DHA Phase 5',
      proposedStartAt: '2026-09-06T16:00:00.000Z',
      stake: 'loser_pays',
    });

    expect(challenge.type).toBe('direct');
    expect(challenge.status).toBe('accepted');
    // It is not on the open board, because it is not open to anyone else.
    expect((await client.listChallenges()).map((each) => each.id)).not.toContain(challenge.id);
  });

  it('takes the sport from the challenging team, not the format field', async () => {
    const client = api();
    const challenge = await client.createChallenge({
      challengerTeamId: 'team-model-town-tigers',
      opponentTeamId: null,
      format: 'cricket_box',
      area: 'Model Town',
      proposedStartAt: '2026-09-05T18:00:00.000Z',
      stake: 'split_cost',
    });

    expect(challenge.sport).toBe('cricket');
  });
});

describe('reporting a score', () => {
  async function accepted() {
    const client = createMockApi({ now: () => new Date(DAY), latencyMs: 0 });
    const challenge = await client.createChallenge({
      challengerTeamId: 'team-my-team',
      opponentTeamId: 'team-dha-strikers',
      format: 'futsal_5v5',
      area: 'Johar Town',
      proposedStartAt: '2026-09-05T16:00:00.000Z',
      stake: 'split_cost',
    });
    return { client, challenge };
  }

  it('does not settle on one captain alone', async () => {
    const { client, challenge } = await accepted();

    const result = await client.reportScore({
      challengeId: challenge.id,
      teamId: 'team-my-team',
      challengerScore: 4,
      opponentScore: 2,
    });

    expect(result.settled).toBe(false);
    expect(result.disputed).toBe(false);
    expect(result.challenge.status).not.toBe('played');
  });

  it('settles when both captains report the same score', async () => {
    const { client, challenge } = await accepted();

    await client.reportScore({
      challengeId: challenge.id,
      teamId: 'team-my-team',
      challengerScore: 4,
      opponentScore: 2,
    });
    const result = await client.reportScore({
      challengeId: challenge.id,
      teamId: 'team-dha-strikers',
      challengerScore: 4,
      opponentScore: 2,
    });

    expect(result.settled).toBe(true);
    expect(result.challenge.status).toBe('played');
  });

  it('leaves a disagreement unsettled rather than trusting one side', async () => {
    const { client, challenge } = await accepted();

    await client.reportScore({
      challengeId: challenge.id,
      teamId: 'team-my-team',
      challengerScore: 4,
      opponentScore: 2,
    });
    const result = await client.reportScore({
      challengeId: challenge.id,
      teamId: 'team-dha-strikers',
      challengerScore: 2,
      opponentScore: 4,
    });

    expect(result.settled).toBe(false);
    expect(result.disputed).toBe(true);
    expect(result.challenge.status).not.toBe('played');
    // Both reports are kept, so an admin can see exactly what each side claimed.
    expect(Object.keys(result.challenge.reportedScores)).toHaveLength(2);
  });

  it('refuses a report from a team that is not playing', async () => {
    const { client, challenge } = await accepted();

    await expect(
      client.reportScore({
        challengeId: challenge.id,
        teamId: 'team-gulberg-gladiators',
        challengerScore: 9,
        opponentScore: 0,
      }),
    ).rejects.toMatchObject({ code: 'not_a_captain' });
  });
});

describe('my challenges', () => {
  const api = () => createMockApi({ now: () => new Date(DAY), latencyMs: 0 });

  it('keeps an accepted challenge visible after it leaves the open board', async () => {
    const client = api();
    const challenge = await client.createChallenge({
      challengerTeamId: 'team-my-team',
      opponentTeamId: 'team-dha-strikers',
      format: 'futsal_5v5',
      area: 'Johar Town',
      proposedStartAt: '2026-09-05T16:00:00.000Z',
      stake: 'split_cost',
    });

    // Off the board, still ours — the case the challenges tab was getting wrong.
    expect((await client.listChallenges()).map((each) => each.id)).not.toContain(challenge.id);
    expect((await client.listMyChallenges()).map((each) => each.id)).toContain(challenge.id);
  });

  it('includes a challenge we are the opponent in, not just ones we posted', async () => {
    const client = api();
    const challenge = await client.createChallenge({
      challengerTeamId: 'team-gulberg-gladiators',
      opponentTeamId: 'team-my-team',
      format: 'futsal_5v5',
      area: 'Gulberg III',
      proposedStartAt: '2026-09-05T16:00:00.000Z',
      stake: 'loser_pays',
    });

    expect((await client.listMyChallenges()).map((each) => each.id)).toContain(challenge.id);
  });

  it('leaves other teams’ challenges out of it', async () => {
    const client = api();
    const challenge = await client.createChallenge({
      challengerTeamId: 'team-cantt-smashers',
      opponentTeamId: 'team-wapda-warriors',
      format: 'padel_doubles',
      area: 'Lahore Cantt',
      proposedStartAt: '2026-09-05T16:00:00.000Z',
      stake: 'split_cost',
    });

    expect((await client.listMyChallenges()).map((each) => each.id)).not.toContain(challenge.id);
  });
});

describe('owner: walk-in bookings', () => {
  const VENUE = 'venue-padel-republic';

  async function evening(api: ReturnType<typeof createMockApi>) {
    const slots = await api.listSlots(COURT, DAY);
    const slot = slots.find(
      (candidate) =>
        candidate.status === 'available' && candidate.startAt.endsWith('16:00:00.000Z'),
    );
    if (!slot) throw new Error('no evening slot');
    return slot;
  }

  it('records a counter booking with the customer the owner took', async () => {
    const api = createMockApi({ now: () => new Date(DAY), latencyMs: 0 });
    const slot = await evening(api);

    const booking = await api.createManualBooking({
      venueId: VENUE,
      courtId: COURT,
      startAt: slot.startAt,
      customerName: 'Imran Sheikh',
      customerPhone: '+923004567890',
    });

    expect(booking.source).toBe('manual');
    expect(booking.customer).toEqual({ name: 'Imran Sheikh', phone: '+923004567890' });
    // Nothing was taken online, so the whole amount is cash at the counter.
    expect(booking.paidOnline).toBe(0);
    expect(booking.dueAtVenue).toBe(booking.total);
  });

  it('blocks the slot everywhere the moment it is entered', async () => {
    const api = createMockApi({ now: () => new Date(DAY), latencyMs: 0 });
    const slot = await evening(api);

    await api.createManualBooking({
      venueId: VENUE,
      courtId: COURT,
      startAt: slot.startAt,
      customerName: 'Imran Sheikh',
      customerPhone: '+923004567890',
    });

    const after = await api.listSlots(COURT, DAY);
    expect(after.find((each) => each.startAt === slot.startAt)?.status).toBe('booked');
    // And a player can no longer take it.
    await expect(api.holdSlot(COURT, slot.startAt)).rejects.toMatchObject({ code: 'slot_taken' });
  });

  it('refuses a walk-in on a slot the app already sold', async () => {
    const api = createMockApi({ now: () => new Date(DAY), latencyMs: 0 });
    const slot = await evening(api);
    const hold = await api.holdSlot(COURT, slot.startAt);
    await api.createBooking({
      intentId: 'intent-app',
      holdId: hold.id,
      paymentMode: 'deposit',
      provider: 'jazzcash',
    });

    await expect(
      api.createManualBooking({
        venueId: VENUE,
        courtId: COURT,
        startAt: slot.startAt,
        customerName: 'Imran Sheikh',
        customerPhone: '+923004567890',
      }),
    ).rejects.toMatchObject({ code: 'slot_taken' });
  });

  it('refuses a walk-in while a player is mid-checkout on that slot', async () => {
    const api = createMockApi({ now: () => new Date(DAY), latencyMs: 0 });
    const slot = await evening(api);
    await api.holdSlot(COURT, slot.startAt);

    await expect(
      api.createManualBooking({
        venueId: VENUE,
        courtId: COURT,
        startAt: slot.startAt,
        customerName: 'Imran Sheikh',
        customerPhone: '+923004567890',
      }),
    ).rejects.toMatchObject({ code: 'slot_taken' });
  });

  it('honours a price the owner overrides at the counter', async () => {
    const api = createMockApi({ now: () => new Date(DAY), latencyMs: 0 });
    const slot = await evening(api);

    const booking = await api.createManualBooking({
      venueId: VENUE,
      courtId: COURT,
      startAt: slot.startAt,
      customerName: 'Imran Sheikh',
      customerPhone: '+923004567890',
      price: 4000,
    });

    expect(booking.total).toBe(4000);
  });
});

describe('owner: the day calendar', () => {
  const VENUE = 'venue-padel-republic';

  it('shows app and walk-in bookings together', async () => {
    const api = createMockApi({ now: () => new Date(DAY), latencyMs: 0 });
    // Two evening slots on the same PKT day. The last slots of the grid are 12 and 1 AM,
    // which belong to the *next* calendar day — correct for a calendar, wrong for this test.
    const slots = await api.listSlots(COURT, DAY);
    const first = slots.find((slot) => slot.startAt.endsWith('16:00:00.000Z'));
    const second = slots.find((slot) => slot.startAt.endsWith('17:00:00.000Z'));
    if (!first || !second) throw new Error('expected two evening slots');

    const hold = await api.holdSlot(COURT, first.startAt);
    await api.createBooking({
      intentId: 'intent-app',
      holdId: hold.id,
      paymentMode: 'deposit',
      provider: 'jazzcash',
    });
    await api.createManualBooking({
      venueId: VENUE,
      courtId: COURT,
      startAt: second.startAt,
      customerName: 'Walk-in',
      customerPhone: '+923001112222',
    });

    const day = await api.listVenueBookings(VENUE, DAY);
    expect(day).toHaveLength(2);
    expect(day.map((booking) => booking.source).sort()).toEqual(['app', 'manual']);
    // Ordered by start time, which is how a counter reads a day.
    expect(new Date(day[0].startAt).getTime()).toBeLessThan(new Date(day[1].startAt).getTime());
  });

  it('leaves a cancelled booking off the calendar', async () => {
    const api = createMockApi({ now: () => new Date(DAY), latencyMs: 0 });
    const slot = (await api.listSlots(COURT, DAY)).filter((each) => each.status === 'available')[0];
    const booking = await api.createManualBooking({
      venueId: VENUE,
      courtId: COURT,
      startAt: slot.startAt,
      customerName: 'Walk-in',
      customerPhone: '+923001112222',
    });

    await api.cancelBooking(booking.id);
    expect(await api.listVenueBookings(VENUE, DAY)).toHaveLength(0);
  });

  it('totals the day, splitting what is collected from what is still owed', async () => {
    const api = createMockApi({ now: () => new Date(DAY), latencyMs: 0 });
    const slot = (await api.listSlots(COURT, DAY)).filter(
      (each) => each.status === 'available' && each.price === 5500,
    )[0];

    await api.createManualBooking({
      venueId: VENUE,
      courtId: COURT,
      startAt: slot.startAt,
      customerName: 'Walk-in',
      customerPhone: '+923001112222',
    });

    const earnings = await api.getVenueEarnings(VENUE, DAY);
    expect(earnings.bookingCount).toBe(1);
    expect(earnings.manualCount).toBe(1);
    expect(earnings.dayTotal).toBe(5500);
    // A counter booking is entirely cash.
    expect(earnings.collectedOnline).toBe(0);
    expect(earnings.dueAtVenue).toBe(5500);
  });
});
