/**
 * In-memory implementation of `MaidanApi`.
 *
 * This is a development stand-in for the backend described in docs/05, not a toy: it
 * enforces the rules the real service must enforce — a slot cannot be held twice, an
 * expired hold cannot be redeemed, and replaying a booking intent returns the original
 * booking rather than making a second one. Building screens against those rules now means
 * the error paths exist before the backend does, instead of being retrofitted after.
 */
import type {
  Booking,
  Challenge,
  ChatThread,
  CurrentPlayer,
  Court,
  Message,
  Notification,
  OpenMatch,
  Player,
  Team,
  Review,
  Slot,
  Venue,
} from '@/domain/types';
import { toPkt } from '@/lib/datetime';
import { perPlayerShare } from '@/lib/money';
import { calculatePayment, resolveSlotPrice } from '@/lib/pricing';

import {
  ApiError,
  type AuthSession,
  type CreateBookingInput,
  type MaidanApi,
  type MatchFilters,
  type SlotHold,
  type VenueFilters,
} from './api';
import * as seed from './seed';

/** How long a checkout hold survives. Mirrors the Redis TTL in docs/05 §5.1. */
export const HOLD_TTL_MS = 5 * 60 * 1000;

/** Bookable window per day, PKT. Venues run late; 9 AM to 2 AM covers the seeded set. */
const FIRST_SLOT_HOUR = 9;
const SLOT_COUNT = 17;
const SLOT_MINUTES = 60;

/** Simulated round trip. Tests pass 0 so they do not have to drive timers to get data. */
const DEFAULT_LATENCY_MS = 220;

function randomId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Six characters, no ambiguous glyphs — this gets read aloud at a counter. */
function bookingCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from(
    { length: 6 },
    () => alphabet[Math.floor(Math.random() * alphabet.length)],
  ).join('');
}

interface MutableState {
  bookings: Booking[];
  holds: SlotHold[];
  /** intentId -> bookingId, so a replayed intent returns the same booking. */
  intents: Map<string, string>;
  matches: OpenMatch[];
  reviews: Review[];
  /** Ids of matches the current player has joined. */
  joinedMatchIds: string[];
  challenges: Challenge[];
  /** Teams created at runtime; the seeded ones are immutable. */
  teams: Team[];
  threads: ChatThread[];
  messages: Message[];
  notifications: Notification[];
  /** Grounds listed at runtime, and the courts on them. The seeded venues are immutable. */
  venues: Venue[];
  courts: Court[];
}

function initialState(seedBookings: boolean, now: () => Date): MutableState {
  return {
    bookings: seedBookings ? seed.exampleBookings(now()) : [],
    holds: [],
    intents: new Map(),
    matches: seed.openMatches.map((match) => ({ ...match })),
    reviews: seed.reviews.map((review) => ({ ...review })),
    joinedMatchIds: [],
    challenges: seed.challenges.map((challenge) => ({ ...challenge })),
    teams: [],
    threads: seed.chatThreads.map((thread) => ({ ...thread })),
    messages: seed.messages.map((message) => ({ ...message })),
    notifications: seed.notifications.map((notification) => ({ ...notification })),
    venues: [],
    courts: [],
  };
}

export interface MockApiOptions {
  /** Injected in tests to freeze the clock. */
  now?: () => Date;
  /** Simulated network latency in milliseconds. */
  latencyMs?: number;
  /**
   * Starts with a couple of bookings already made.
   *
   * On for the running app, so My Bookings and the booked-details screen have something to
   * show without walking checkout first. Off by default, so tests begin from an empty
   * ledger and can assert on exactly what they created.
   */
  seedBookings?: boolean;
}

/**
 * The account the mock starts signed in as.
 *
 * Setup is already done, because the mock exists so the whole app can be opened and used
 * without a backend — landing every launch on "what do you play?" would defeat that. The
 * auth calls below reset it to unfinished when someone registers, so the setup flow can
 * still be exercised deliberately.
 */
function initialAccount(): CurrentPlayer {
  const me = seed.players.find((player) => player.id === seed.CURRENT_USER_ID);
  return {
    id: seed.CURRENT_USER_ID,
    name: me?.name ?? 'Player',
    avatarUrl: me?.avatarUrl ?? null,
    reliability: me?.reliability ?? 100,
    gamesPlayed: me?.gamesPlayed ?? 0,
    skillBySport: me?.skillBySport ?? {},
    email: 'umer@maidan.pk',
    phone: '+923001234567',
    sports: ['padel', 'futsal', 'cricket'],
    city: 'lahore',
    // A player account. The owner and admin surfaces are reached in development through
    // the gate bypass, not by pretending every mock user runs a ground.
    ownedVenueIds: [],
    isAdmin: false,
  };
}

export function createMockApi(
  nowOrOptions: (() => Date) | MockApiOptions = {},
): MaidanApi & { reset(): void } {
  const options: MockApiOptions =
    typeof nowOrOptions === 'function' ? { now: nowOrOptions } : nowOrOptions;
  const now = options.now ?? (() => new Date());
  const latencyMs = options.latencyMs ?? DEFAULT_LATENCY_MS;
  const seedBookings = options.seedBookings ?? false;

  const delay = <T>(value: T): Promise<T> =>
    latencyMs === 0
      ? Promise.resolve(value)
      : new Promise((resolve) => setTimeout(() => resolve(value), latencyMs));

  let state = initialState(seedBookings, now);

  /**
   * The signed-in account.
   *
   * Held apart from `state`, which `reset()` rebuilds between tests. A test that resets the
   * data should not find itself signed out as a side effect.
   */
  let account: CurrentPlayer = initialAccount();

  /** `delay` with nothing to carry, for the calls that return a value built in place. */
  const latency = () => delay(undefined);

  const liveHolds = () => state.holds.filter((hold) => new Date(hold.expiresAt) > now());

  const isTaken = (courtId: string, startAt: string) =>
    state.bookings.some(
      (booking) =>
        booking.courtId === courtId &&
        booking.startAt === startAt &&
        booking.status !== 'cancelled',
    );

  const isHeld = (courtId: string, startAt: string) =>
    liveHolds().some((hold) => hold.courtId === courtId && hold.startAt === startAt);

  function findCourt(courtId: string): Court {
    const court = seed.courts.find((candidate) => candidate.id === courtId);
    if (!court) throw new ApiError('not_found', `No court ${courtId}`);
    return court;
  }

  function findVenue(venueId: string): Venue {
    const venue = seed.venues.find((candidate) => candidate.id === venueId);
    if (!venue) throw new ApiError('not_found', `No venue ${venueId}`);
    return venue;
  }

  return {
    reset() {
      state = initialState(seedBookings, now);
    },

    async listVenues(filters: VenueFilters = {}) {
      const query = filters.query?.trim().toLowerCase();
      return delay(
        // Seeded and runtime grounds together, so a venue listed and published in this
        // session shows up in search exactly as it would against the server.
        [...seed.venues, ...state.venues].filter((venue) => {
          if (venue.status !== 'live') return false;
          if (filters.sport && !venue.sports.includes(filters.sport)) return false;
          if (filters.maxPricePerHour && venue.fromPricePerHour > filters.maxPricePerHour) {
            return false;
          }
          if (query) {
            const haystack = `${venue.name} ${venue.area}`.toLowerCase();
            if (!haystack.includes(query)) return false;
          }
          return true;
        }),
      );
    },

    async listReviews(venueId) {
      return delay(
        state.reviews
          .filter((review) => review.venueId === venueId)
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
      );
    },

    async getVenue(venueId) {
      return delay(findVenue(venueId));
    },

    async listCourts(venueId) {
      return delay(seed.courts.filter((court) => court.venueId === venueId));
    },

    async listSlots(courtId, dayIso) {
      const court = findCourt(courtId);
      const day = toPkt(dayIso);

      const slots: Slot[] = Array.from({ length: SLOT_COUNT }, (_, index) => {
        const hour = FIRST_SLOT_HOUR + index;
        // PKT is UTC+5; building in UTC keeps the arithmetic free of device-zone drift.
        const start = new Date(Date.UTC(day.year, day.month - 1, day.day, hour - 5, 0, 0));
        const end = new Date(start.getTime() + SLOT_MINUTES * 60_000);
        const startAt = start.toISOString();
        const { price, isPeak } = resolveSlotPrice(court, startAt);

        let status: Slot['status'] = 'available';
        if (isTaken(courtId, startAt)) status = 'booked';
        else if (isHeld(courtId, startAt)) status = 'held';
        else if (start < now()) status = 'blocked';

        return { courtId, startAt, endAt: end.toISOString(), price, status, isPeak };
      });

      return delay(slots);
    },

    async holdSlot(courtId, startAt) {
      if (isTaken(courtId, startAt)) {
        throw new ApiError('slot_taken', 'That slot has just been booked.');
      }
      if (isHeld(courtId, startAt)) {
        throw new ApiError('slot_taken', 'Another player is checking out for that slot.');
      }

      const hold: SlotHold = {
        id: randomId('hold'),
        courtId,
        startAt,
        endAt: new Date(new Date(startAt).getTime() + SLOT_MINUTES * 60_000).toISOString(),
        expiresAt: new Date(now().getTime() + HOLD_TTL_MS).toISOString(),
      };
      state.holds.push(hold);
      return delay(hold);
    },

    async releaseHold(holdId) {
      state.holds = state.holds.filter((hold) => hold.id !== holdId);
      return delay(undefined);
    },

    async createBooking(input: CreateBookingInput) {
      // Idempotency first: a retry must return the original booking, never a second one.
      const existingId = state.intents.get(input.intentId);
      if (existingId) {
        const existing = state.bookings.find((booking) => booking.id === existingId);
        if (existing) return delay(existing);
      }

      const hold = state.holds.find((candidate) => candidate.id === input.holdId);
      if (!hold) throw new ApiError('hold_expired', 'Your slot hold has expired.');
      if (new Date(hold.expiresAt) <= now()) {
        state.holds = state.holds.filter((candidate) => candidate.id !== hold.id);
        throw new ApiError('hold_expired', 'Your slot hold has expired.');
      }
      if (isTaken(hold.courtId, hold.startAt)) {
        throw new ApiError('slot_taken', 'That slot has just been booked.');
      }

      const court = findCourt(hold.courtId);
      const { price } = resolveSlotPrice(court, hold.startAt);
      const breakdown = calculatePayment(price, input.paymentMode);

      const booking: Booking = {
        id: randomId('booking'),
        intentId: input.intentId,
        courtId: court.id,
        venueId: court.venueId,
        userId: seed.CURRENT_USER_ID,
        teamId: null,
        startAt: hold.startAt,
        endAt: hold.endAt,
        status: 'confirmed',
        total: breakdown.total,
        paidOnline: breakdown.payNow,
        dueAtVenue: breakdown.dueAtVenue,
        paymentMode: input.paymentMode,
        provider: input.provider,
        source: 'app',
        cancellationPolicy: seed.STANDARD_POLICY,
        code: bookingCode(),
        customer: null,
        createdAt: now().toISOString(),
      };

      state.bookings.push(booking);
      state.intents.set(input.intentId, booking.id);
      state.holds = state.holds.filter((candidate) => candidate.id !== hold.id);

      return delay(booking);
    },

    async submitReview(input) {
      const booking = state.bookings.find((candidate) => candidate.id === input.bookingId);
      if (!booking) throw new ApiError('not_found', `No booking ${input.bookingId}`);

      // A review is only verified if the player actually played.
      if (booking.status !== 'completed' && booking.status !== 'checked_in') {
        throw new ApiError('not_played', 'You can review a ground after you have played there.');
      }
      if (state.reviews.some((review) => review.bookingId === booking.id)) {
        throw new ApiError('already_reviewed', 'You have already reviewed this booking.');
      }

      const me = seed.players.find((player) => player.id === seed.CURRENT_USER_ID);
      const review: Review = {
        id: randomId('review'),
        venueId: booking.venueId,
        bookingId: booking.id,
        authorId: seed.CURRENT_USER_ID,
        authorName: me?.name ?? 'You',
        authorAvatarUrl: me?.avatarUrl ?? null,
        rating: Math.min(5, Math.max(1, Math.round(input.rating))),
        body: input.body.trim(),
        createdAt: now().toISOString(),
      };
      state.reviews.push(review);
      return delay(review);
    },

    async listVenueBookings(venueId, dayIso) {
      /*
       * Days are PKT calendar days, so a venue running past midnight has its 1 AM slots on
       * the following day's sheet. That is what a calendar means, and it matches how the
       * slot grid is built — but it is worth knowing before reading a night's takings.
       */
      const day = toPkt(dayIso);
      return delay(
        state.bookings
          .filter((booking) => {
            if (booking.venueId !== venueId || booking.status === 'cancelled') return false;
            const start = toPkt(booking.startAt);
            return start.year === day.year && start.month === day.month && start.day === day.day;
          })
          .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime()),
      );
    },

    async createManualBooking(input) {
      // `venueId` is carried for the HTTP route; the court is what actually decides the
      // venue, so it is derived rather than trusted.
      void input.venueId;
      // The same check an app booking faces. A walk-in that skipped it would let the owner
      // sell a court the marketplace has already sold.
      if (isTaken(input.courtId, input.startAt)) {
        throw new ApiError('slot_taken', 'That slot is already booked.');
      }
      if (isHeld(input.courtId, input.startAt)) {
        throw new ApiError('slot_taken', 'A player is checking out for that slot right now.');
      }

      const court = findCourt(input.courtId);
      const { price } = resolveSlotPrice(court, input.startAt);
      const total = input.price ?? price;

      const booking: Booking = {
        id: randomId('booking'),
        intentId: randomId('manual'),
        courtId: court.id,
        venueId: court.venueId,
        // A walk-in has no Maidan account; the owner is the one recording it.
        userId: seed.venues.find((venue) => venue.id === court.venueId)?.ownerId ?? '',
        teamId: null,
        startAt: input.startAt,
        endAt: new Date(new Date(input.startAt).getTime() + SLOT_MINUTES * 60_000).toISOString(),
        status: 'confirmed',
        total,
        // Nothing was collected online: the whole amount is cash at the counter.
        paidOnline: 0,
        dueAtVenue: total,
        paymentMode: 'deposit',
        provider: null,
        source: 'manual',
        cancellationPolicy: seed.STANDARD_POLICY,
        code: bookingCode(),
        customer: { name: input.customerName.trim(), phone: input.customerPhone.trim() },
        createdAt: now().toISOString(),
      };

      state.bookings.push(booking);
      return delay(booking);
    },

    async getVenueEarnings(venueId, dayIso) {
      const day = toPkt(dayIso);
      const dayKey = `${day.year}-${day.month}-${day.day}`;
      const weekStart = new Date(new Date(dayIso).getTime() - 6 * 24 * 3_600_000);

      const live = state.bookings.filter(
        (booking) => booking.venueId === venueId && booking.status !== 'cancelled',
      );
      const onDay = live.filter((booking) => {
        const start = toPkt(booking.startAt);
        return `${start.year}-${start.month}-${start.day}` === dayKey;
      });
      const inWeek = live.filter((booking) => {
        const start = new Date(booking.startAt);
        return start >= weekStart && start <= new Date(dayIso);
      });

      const sum = (list: Booking[], pick: (booking: Booking) => number) =>
        list.reduce((total, booking) => total + pick(booking), 0);

      return delay({
        dayTotal: sum(onDay, (booking) => booking.total),
        weekTotal: sum(inWeek, (booking) => booking.total),
        collectedOnline: sum(onDay, (booking) => booking.paidOnline),
        dueAtVenue: sum(onDay, (booking) => booking.dueAtVenue),
        bookingCount: onDay.length,
        manualCount: onDay.filter((booking) => booking.source === 'manual').length,
      });
    },

    async listBookings() {
      return delay(
        [...state.bookings].sort(
          (a, b) => new Date(b.startAt).getTime() - new Date(a.startAt).getTime(),
        ),
      );
    },

    async getBooking(bookingId) {
      const booking = state.bookings.find((candidate) => candidate.id === bookingId);
      if (!booking) throw new ApiError('not_found', `No booking ${bookingId}`);
      return delay(booking);
    },

    async cancelBooking(bookingId) {
      const booking = state.bookings.find((candidate) => candidate.id === bookingId);
      if (!booking) throw new ApiError('not_found', `No booking ${bookingId}`);
      booking.status = 'cancelled';
      return delay(booking);
    },

    async createOpenMatch(input) {
      const booking = state.bookings.find((candidate) => candidate.id === input.bookingId);
      if (!booking) throw new ApiError('not_found', `No booking ${input.bookingId}`);
      if (state.matches.some((match) => match.bookingId === booking.id)) {
        throw new ApiError('already_open', 'This booking is already open to other players.');
      }

      const court = findCourt(booking.courtId);
      const match: OpenMatch = {
        id: randomId('match'),
        bookingId: booking.id,
        hostId: booking.userId,
        venueId: booking.venueId,
        courtId: booking.courtId,
        sport: court.sport,
        format: input.format,
        startAt: booking.startAt,
        playersNeeded: input.playersNeeded,
        playersJoined: input.playersJoined,
        skillLevel: input.skillLevel,
        genderPreference: input.genderPreference,
        // Derived from what the booking actually cost, so the host cannot advertise a
        // share that does not add up to the slot.
        pricePerPlayer: perPlayerShare(booking.total, input.playersNeeded),
        note: input.note,
        instantJoin: input.instantJoin,
        status: input.playersJoined >= input.playersNeeded ? 'full' : 'open',
      };

      state.matches.unshift(match);
      return delay(match);
    },

    async listOpenMatches(filters: MatchFilters = {}) {
      return delay(
        state.matches.filter((match) => {
          if (match.status !== 'open') return false;
          if (filters.sport && match.sport !== filters.sport) return false;
          if (filters.skillLevel && match.skillLevel !== filters.skillLevel) return false;
          return true;
        }),
      );
    },

    async listMyMatches() {
      return delay(state.matches.filter((match) => state.joinedMatchIds.includes(match.id)));
    },

    async getOpenMatch(matchId) {
      const match = state.matches.find((candidate) => candidate.id === matchId);
      if (!match) throw new ApiError('not_found', `No match ${matchId}`);
      return delay(match);
    },

    async requestToJoinMatch(matchId) {
      const match = state.matches.find((candidate) => candidate.id === matchId);
      if (!match) throw new ApiError('not_found', `No match ${matchId}`);
      if (match.playersJoined >= match.playersNeeded) {
        match.status = 'full';
        throw new ApiError('slot_taken', 'This match just filled up.');
      }
      match.playersJoined += 1;
      if (!state.joinedMatchIds.includes(matchId)) state.joinedMatchIds.push(matchId);
      if (match.playersJoined >= match.playersNeeded) match.status = 'full';
      return delay(match);
    },

    async listChallenges() {
      return delay(state.challenges.filter((challenge) => challenge.status === 'open'));
    },

    async listMyChallenges() {
      const myTeamIds = seed.teams
        .filter((team) => team.memberIds.includes(seed.CURRENT_USER_ID))
        .map((team) => team.id);

      return delay(
        state.challenges.filter(
          (challenge) =>
            myTeamIds.includes(challenge.challengerTeamId) ||
            (challenge.opponentTeamId !== null && myTeamIds.includes(challenge.opponentTeamId)),
        ),
      );
    },

    async getChallenge(challengeId) {
      const challenge = state.challenges.find((candidate) => candidate.id === challengeId);
      if (!challenge) throw new ApiError('not_found', `No challenge ${challengeId}`);
      return delay(challenge);
    },

    async createChallenge(input) {
      const challenge: Challenge = {
        id: randomId('challenge'),
        type: input.opponentTeamId ? 'direct' : 'open',
        challengerTeamId: input.challengerTeamId,
        opponentTeamId: input.opponentTeamId,
        sport: seed.teams.find((team) => team.id === input.challengerTeamId)?.sport ?? 'futsal',
        format: input.format,
        area: input.area,
        proposedStartAt: input.proposedStartAt,
        stake: input.stake,
        status: input.opponentTeamId ? 'accepted' : 'open',
        agreedBookingId: null,
        reportedScores: {},
      };
      state.challenges.unshift(challenge);
      return delay(challenge);
    },

    async reportScore(input) {
      const challenge = state.challenges.find((each) => each.id === input.challengeId);
      if (!challenge) throw new ApiError('not_found', `No challenge ${input.challengeId}`);

      const isParticipant =
        input.teamId === challenge.challengerTeamId || input.teamId === challenge.opponentTeamId;
      if (!isParticipant) {
        throw new ApiError('not_a_captain', 'Only the two teams playing can report a score.');
      }

      challenge.reportedScores = {
        ...challenge.reportedScores,
        [input.teamId]: {
          challenger: input.challengerScore,
          opponent: input.opponentScore,
        },
      };

      const reports = Object.values(challenge.reportedScores);
      const bothReported = reports.length === 2;
      const agree =
        bothReported &&
        reports[0].challenger === reports[1].challenger &&
        reports[0].opponent === reports[1].opponent;

      // The leaderboard only moves on agreement; a disagreement leaves both reports
      // standing and the result unsettled for an admin to resolve.
      if (agree) challenge.status = 'played';

      return delay({
        challenge,
        settled: agree,
        disputed: bothReported && !agree,
      });
    },

    async acceptChallenge(challengeId) {
      const challenge = state.challenges.find((candidate) => candidate.id === challengeId);
      if (!challenge) throw new ApiError('not_found', `No challenge ${challengeId}`);
      challenge.status = 'accepted';
      challenge.opponentTeamId = 'team-my-team';
      return delay(challenge);
    },

    async listTeams() {
      return delay([...seed.teams, ...state.teams]);
    },

    async createTeam(input) {
      const team: Team = {
        id: randomId('team'),
        name: input.name.trim(),
        sport: input.sport,
        city: input.city,
        crestUrl: null,
        captainId: seed.CURRENT_USER_ID,
        wins: 0,
        losses: 0,
        // No record yet, so no rank. A team ranks once it has played.
        cityRank: null,
        memberIds: [
          seed.CURRENT_USER_ID,
          ...input.memberIds.filter((id) => id !== seed.CURRENT_USER_ID),
        ],
      };
      state.teams.push(team);
      return delay(team);
    },

    async getTeam(teamId) {
      const team = [...seed.teams, ...state.teams].find((candidate) => candidate.id === teamId);
      if (!team) throw new ApiError('not_found', `No team ${teamId}`);
      return delay(team);
    },

    async listThreads() {
      return delay(
        [...state.threads].sort(
          (a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime(),
        ),
      );
    },

    async listMessages(threadId) {
      return delay(state.messages.filter((message) => message.threadId === threadId));
    },

    async sendMessage(threadId, body) {
      const message: Message = {
        id: randomId('msg'),
        threadId,
        authorId: seed.CURRENT_USER_ID,
        authorName: 'You',
        body,
        sentAt: now().toISOString(),
        mine: true,
      };
      state.messages.push(message);

      const thread = state.threads.find((candidate) => candidate.id === threadId);
      if (thread) {
        thread.lastMessage = body;
        thread.lastMessageAt = message.sentAt;
        thread.unreadCount = 0;
      }
      return delay(message);
    },

    async listNotifications() {
      return delay(state.notifications);
    },

    async getPlayer(playerId) {
      const player = seed.players.find((candidate) => candidate.id === playerId);
      if (!player) throw new ApiError('not_found', `No player ${playerId}`);
      return delay(player);
    },

    async listPlayers(playerIds) {
      const byId = new Map(seed.players.map((player) => [player.id, player]));
      return delay(
        playerIds.map((id) => byId.get(id)).filter((player): player is Player => Boolean(player)),
      );
    },

    async searchPlayers(query) {
      const needle = query.trim().toLowerCase();
      return delay(
        seed.players.filter(
          (player) =>
            player.id !== seed.CURRENT_USER_ID &&
            (needle.length === 0 || player.name.toLowerCase().includes(needle)),
        ),
      );
    },

    async currentPlayer() {
      await latency();
      return { ...account };
    },

    async updateProfile(input) {
      await latency();
      if (input.fullName !== undefined) account.name = input.fullName.trim();
      if (input.sports !== undefined) account.sports = input.sports;
      if (input.city !== undefined) account.city = input.city;
      return { ...account };
    },

    /*
     * Auth against memory.
     *
     * The mock accepts any well-formed credentials rather than checking them, because its
     * job is to run the app with no network — not to be a second implementation of the
     * security rules, which would be a second place for them to be wrong. What it does
     * reproduce faithfully is the *shape*: a session with both tokens, and an account that
     * starts with no sports and no city so the setup gate behaves as it does in production.
     */
    async register(input) {
      await latency();
      account = {
        ...account,
        name: input.fullName.trim(),
        email: input.email.trim().toLowerCase(),
        phone: input.phone,
        sports: [],
        city: null,
      };
      return mockSession();
    },

    async login(email) {
      await latency();
      account = { ...account, email: email.trim().toLowerCase() };
      return mockSession();
    },

    async requestOtp(phone) {
      await latency();
      return { phone, expiresInSeconds: 300, devCode: '000000' };
    },

    async verifyOtp(phone, _code, fullName) {
      await latency();
      account = { ...account, phone, name: fullName?.trim() || account.name };
      return mockSession();
    },

    async signOut() {
      await latency();
    },

    // ------------------------------------------------------------------ owner side --
    //
    // The approval gate is reproduced here, not skipped. A mock that let an owner book on
    // a pending ground would make the flow look finished while the server refused it, and
    // the whole point of the mock is that a screen behaves the same against either.

    async listMyVenues() {
      await latency();
      return [...seed.venues, ...state.venues].filter((venue) => venue.ownerId === account.id);
    },

    async createVenue(input) {
      await latency();
      const venue: Venue = {
        id: `venue-${Date.now().toString(36)}`,
        ownerId: account.id,
        name: input.name.trim(),
        city: input.city,
        area: input.area.trim(),
        geo: { latitude: input.latitude, longitude: input.longitude },
        sports: [],
        amenities: input.amenities ?? [],
        photos: input.photos ?? [],
        about: input.about ?? '',
        hours: { opensAt: input.opensAt, closesAt: input.closesAt },
        // Derived from the courts, so it stays at zero until there is one.
        fromPricePerHour: 0,
        phone: input.phone ?? '',
        rating: null,
        reviewCount: 0,
        playerCount: 0,
        status: 'pending',
        reviewNote: null,
        cancellationPolicyId: 'standard',
      };
      state.venues.push(venue);
      return { ...venue };
    },

    async updateVenue(venueId, input) {
      await latency();
      const venue = mutableVenue(venueId);
      Object.assign(venue, {
        name: input.name?.trim() ?? venue.name,
        city: input.city ?? venue.city,
        area: input.area?.trim() ?? venue.area,
        about: input.about ?? venue.about,
        phone: input.phone ?? venue.phone,
        amenities: input.amenities ?? venue.amenities,
        photos: input.photos ?? venue.photos,
        hours: {
          opensAt: input.opensAt ?? venue.hours.opensAt,
          closesAt: input.closesAt ?? venue.hours.closesAt,
        },
      });
      return { ...venue };
    },

    async addCourt(venueId, input) {
      await latency();
      mutableVenue(venueId);
      const court: Court = {
        id: `court-${Date.now().toString(36)}-${state.courts.length}`,
        venueId,
        name: input.name.trim(),
        sport: input.sport,
        format: input.format,
        surface: input.surface ?? '',
        indoor: input.indoor ?? false,
        basePricePerHour: input.basePricePerHour,
        peakRules: input.peakRules ?? [],
      };
      state.courts.push(court);
      syncVenue(venueId);
      return { ...court };
    },

    async updateCourt(courtId, input) {
      await latency();
      const court = state.courts.find((candidate) => candidate.id === courtId);
      if (!court) throw new ApiError('not_found', 'No such court');
      Object.assign(court, {
        name: input.name?.trim() ?? court.name,
        sport: input.sport ?? court.sport,
        format: input.format ?? court.format,
        surface: input.surface ?? court.surface,
        indoor: input.indoor ?? court.indoor,
        basePricePerHour: input.basePricePerHour ?? court.basePricePerHour,
        peakRules: input.peakRules ?? court.peakRules,
      });
      syncVenue(court.venueId);
      return { ...court };
    },

    async removeCourt(courtId) {
      await latency();
      const court = state.courts.find((candidate) => candidate.id === courtId);
      if (!court) throw new ApiError('not_found', 'No such court');
      if (state.bookings.some((booking) => booking.courtId === courtId)) {
        throw new ApiError(
          'validation',
          'This court has bookings. Cancel them before removing it.',
        );
      }
      state.courts = state.courts.filter((candidate) => candidate.id !== courtId);
      syncVenue(court.venueId);
    },

    async publishVenue(venueId) {
      await latency();
      const venue = mutableVenue(venueId);
      if (!state.courts.some((court) => court.venueId === venueId)) {
        throw new ApiError('validation', 'Add at least one court before going live.');
      }
      if (venue.status !== 'verified' && venue.status !== 'live') {
        throw new ApiError('validation', 'This ground has not been approved yet.');
      }
      venue.status = 'live';
      return { ...venue };
    },

    async unpublishVenue(venueId) {
      await latency();
      const venue = mutableVenue(venueId);
      if (venue.status !== 'live') throw new ApiError('validation', 'This ground is not live.');
      venue.status = 'verified';
      return { ...venue };
    },

    // ----------------------------------------------------------------------- admin --

    async listVenuesForReview(status) {
      await latency();
      return state.venues.filter((venue) => venue.status === status).map((v) => ({ ...v }));
    },

    async approveVenue(venueId, note) {
      await latency();
      const venue = mutableVenue(venueId);
      venue.status = 'verified';
      venue.reviewNote = note ?? null;
      return { ...venue };
    },

    async rejectVenue(venueId, note) {
      await latency();
      const venue = mutableVenue(venueId);
      venue.status = 'rejected';
      venue.reviewNote = note;
      return { ...venue };
    },

    async suspendVenue(venueId, note) {
      await latency();
      const venue = mutableVenue(venueId);
      if (venue.status !== 'live') throw new ApiError('validation', 'That ground is not live.');
      venue.status = 'verified';
      venue.reviewNote = note;
      return { ...venue };
    },

    async listPlayersForAdmin(search) {
      await latency();
      const needle = search?.trim().toLowerCase() ?? '';
      // The mock has exactly one admin — the account it signs you in as — so the list is
      // short by construction rather than by filtering.
      const everyone = seed.players.map((player) => ({
        ...account,
        id: player.id,
        name: player.name,
        avatarUrl: player.avatarUrl,
        email: `${player.id}@maidan.test`,
        isAdmin: player.id === account.id,
      }));
      return needle
        ? everyone.filter((player) => player.name.toLowerCase().includes(needle))
        : everyone.filter((player) => player.isAdmin);
    },

    async setAdmin(playerId, isAdmin) {
      await latency();
      if (playerId === account.id) {
        if (!isAdmin) throw new ApiError('validation', 'You cannot remove your own admin access.');
        account.isAdmin = true;
      }
      return { ...account, id: playerId, isAdmin };
    },
  };

  /** A runtime venue by id. Seeded ones are immutable, so they are not offered for editing. */
  function mutableVenue(venueId: string): Venue {
    const venue = state.venues.find((candidate) => candidate.id === venueId);
    if (!venue) throw new ApiError('not_found', 'No such ground');
    return venue;
  }

  /**
   * Keeps the venue's headline price and sport list in step with its courts, as the server
   * does. Both are copies kept for the discovery list, and a copy that is not refreshed is
   * a lie: adding a cheaper court has to move the "from" price a player sees.
   */
  function syncVenue(venueId: string): void {
    const venue = state.venues.find((candidate) => candidate.id === venueId);
    if (!venue) return;
    const courts = state.courts.filter((court) => court.venueId === venueId);
    venue.fromPricePerHour = courts.length
      ? Math.min(...courts.map((court) => court.basePricePerHour))
      : 0;
    venue.sports = [...new Set(courts.map((court) => court.sport))].sort();
  }
}

/**
 * A session shaped like the server's, with tokens that are obviously not real.
 *
 * Deliberately not random: a token that looks plausible invites someone to wonder whether
 * the mock is doing cryptography, and it is not.
 */
function mockSession(): AuthSession {
  return {
    accessToken: 'mock-access-token',
    refreshToken: 'mock-refresh-token',
    expiresIn: 15 * 60,
    playerId: seed.CURRENT_USER_ID,
  };
}
