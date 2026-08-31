/**
 * HTTP implementation of `MaidanApi`.
 *
 * The same interface the mock implements, so every screen works against either without a
 * line changing — that was the point of putting the interface between them.
 *
 * Server errors arrive as `{ error: { code, message } }` using the same `ApiErrorCode`
 * vocabulary, so a failure crosses the wire and lands as the identical `ApiError` the
 * screens already handle. A "slot taken" stays a "slot taken".
 */
import type {
  Booking,
  Challenge,
  ChatThread,
  Court,
  Message,
  Notification,
  OpenMatch,
  Player,
  Review,
  Slot,
  Team,
  Venue,
} from '@/domain/types';

import {
  ApiError,
  type ChallengeResult,
  type CreateBookingInput,
  type CreateChallengeInput,
  type CreateOpenMatchInput,
  type CreateTeamInput,
  type MaidanApi,
  type ManualBookingInput,
  type MatchFilters,
  type ReportScoreInput,
  type SlotHold,
  type SubmitReviewInput,
  type VenueEarnings,
  type VenueFilters,
} from './api';

export interface HttpApiOptions {
  baseUrl: string;
  /** Stands in for the auth token until phone + OTP is wired. */
  userId?: string;
  /** Requests are abandoned after this, so a dead network fails fast rather than hanging. */
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 12_000;

export function createHttpApi({
  baseUrl,
  userId = 'player-self',
  timeoutMs = DEFAULT_TIMEOUT_MS,
}: HttpApiOptions): MaidanApi {
  async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    let response: Response;
    try {
      response = await fetch(`${baseUrl}${path}`, {
        method,
        headers: { 'content-type': 'application/json', 'x-user-id': userId },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });
    } catch {
      // A timeout or a dropped connection — the case docs/04 §6 says to expect.
      throw new ApiError('network', 'Could not reach Maidan. Check your connection.');
    } finally {
      clearTimeout(timer);
    }

    if (response.status === 204) return undefined as T;

    const text = await response.text();
    const payload = text ? JSON.parse(text) : null;

    if (!response.ok) {
      const code = payload?.error?.code ?? 'network';
      throw new ApiError(code, payload?.error?.message ?? 'Something went wrong');
    }
    return payload as T;
  }

  const query = (params: Record<string, string | number | undefined>) => {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== '') search.set(key, String(value));
    }
    const encoded = search.toString();
    return encoded ? `?${encoded}` : '';
  };

  return {
    listVenues: (filters: VenueFilters = {}) =>
      request<Venue[]>(
        'GET',
        `/venues${query({
          sport: filters.sport,
          query: filters.query,
          maxPricePerHour: filters.maxPricePerHour,
        })}`,
      ),
    getVenue: (venueId) => request<Venue>('GET', `/venues/${venueId}`),
    listCourts: (venueId) => request<Court[]>('GET', `/venues/${venueId}/courts`),
    listReviews: (venueId) => request<Review[]>('GET', `/venues/${venueId}/reviews`),

    listSlots: (courtId, dayIso) =>
      request<Slot[]>('GET', `/courts/${courtId}/slots${query({ day: dayIso })}`),
    holdSlot: (courtId, startAt) => request<SlotHold>('POST', '/holds', { courtId, startAt }),
    releaseHold: (holdId) => request<void>('DELETE', `/holds/${holdId}`),

    createBooking: (input: CreateBookingInput) => request<Booking>('POST', '/bookings', input),
    listBookings: () => request<Booking[]>('GET', '/bookings'),
    getBooking: (bookingId) => request<Booking>('GET', `/bookings/${bookingId}`),
    cancelBooking: (bookingId) => request<Booking>('POST', `/bookings/${bookingId}/cancel`),
    submitReview: (input: SubmitReviewInput) =>
      request<Review>('POST', `/bookings/${input.bookingId}/review`, {
        rating: input.rating,
        body: input.body,
      }),

    listVenueBookings: (venueId, dayIso) =>
      request<Booking[]>('GET', `/venues/${venueId}/bookings${query({ day: dayIso })}`),
    createManualBooking: (input: ManualBookingInput) =>
      request<Booking>('POST', `/venues/${input.venueId}/bookings`, input),
    getVenueEarnings: (venueId, dayIso) =>
      request<VenueEarnings>('GET', `/venues/${venueId}/earnings${query({ day: dayIso })}`),

    createOpenMatch: (input: CreateOpenMatchInput) => request<OpenMatch>('POST', '/matches', input),
    listOpenMatches: (filters: MatchFilters = {}) =>
      request<OpenMatch[]>(
        'GET',
        `/matches${query({ sport: filters.sport, skillLevel: filters.skillLevel })}`,
      ),
    listMyMatches: () => request<OpenMatch[]>('GET', '/matches/mine'),
    getOpenMatch: (matchId) => request<OpenMatch>('GET', `/matches/${matchId}`),
    requestToJoinMatch: (matchId) => request<OpenMatch>('POST', `/matches/${matchId}/join`),

    listChallenges: () => request<Challenge[]>('GET', '/challenges'),
    listMyChallenges: () => request<Challenge[]>('GET', '/challenges/mine'),
    getChallenge: (challengeId) => request<Challenge>('GET', `/challenges/${challengeId}`),
    createChallenge: (input: CreateChallengeInput) =>
      request<Challenge>('POST', '/challenges', input),
    acceptChallenge: (challengeId) =>
      request<Challenge>('POST', `/challenges/${challengeId}/accept`),
    reportScore: (input: ReportScoreInput) =>
      request<ChallengeResult>('POST', `/challenges/${input.challengeId}/score`, input),

    listTeams: () => request<Team[]>('GET', '/teams'),
    createTeam: (input: CreateTeamInput) => request<Team>('POST', '/teams', input),
    getTeam: (teamId) => request<Team>('GET', `/teams/${teamId}`),

    listThreads: () => request<ChatThread[]>('GET', '/threads'),
    listMessages: (threadId) => request<Message[]>('GET', `/threads/${threadId}/messages`),
    sendMessage: (threadId, body) =>
      request<Message>('POST', `/threads/${threadId}/messages`, { body }),

    listNotifications: () => request<Notification[]>('GET', '/notifications'),
    getPlayer: (playerId) => request<Player>('GET', `/players/${playerId}`),
    listPlayers: (playerIds) =>
      request<Player[]>('GET', `/players${query({ ids: playerIds.join(',') })}`),
    searchPlayers: (search) => request<Player[]>('GET', `/players${query({ query: search })}`),
    currentPlayer: () => request<Player>('GET', '/players/me'),
  };
}
