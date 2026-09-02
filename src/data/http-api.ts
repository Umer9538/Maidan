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
  Blackout,
  Booking,
  Challenge,
  ChatThread,
  Court,
  CurrentPlayer,
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
  type AuthSession,
  type BlackoutCreated,
  type ChallengeResult,
  type CreateBookingInput,
  type CreateChallengeInput,
  type CreateOpenMatchInput,
  type CreateTeamInput,
  type MaidanApi,
  type ManualBookingInput,
  type MatchFilters,
  type OtpChallenge,
  type ReportScoreInput,
  type SlotHold,
  type SubmitReviewInput,
  type VenueEarnings,
  type VenueFilters,
} from './api';

/**
 * How the client gets a token and what it does when one stops working.
 *
 * Supplied rather than built in, so the store can be swapped in a test and so this module
 * has no opinion about where a token is kept.
 */
export interface TokenProvider {
  /** The current access token, or null when there is no session. */
  getAccessToken: () => Promise<string | null>;
  /**
   * Trades the refresh token for a new access token, returning null if the session is
   * over. Called at most once per expiry — see `refreshOnce` below.
   */
  refresh: () => Promise<string | null>;
  /** Called when the session cannot be recovered, so the app can send the player to sign-in. */
  onSignedOut?: () => void;
}

export interface HttpApiOptions {
  baseUrl: string;
  /** Omitted only in tests that never reach an authenticated route. */
  tokens?: TokenProvider;
  /** Requests are abandoned after this, so a dead network fails fast rather than hanging. */
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 12_000;

export function createHttpApi({
  baseUrl,
  tokens,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}: HttpApiOptions): MaidanApi {
  /**
   * The in-flight refresh, shared by every request that finds itself unauthorised.
   *
   * This is not an optimisation. Refresh tokens rotate and the server treats a token
   * presented twice as evidence that it leaked — it revokes the whole family. A screen
   * that fires five queries on mount would, without this, hit five 401s, start five
   * refreshes with the same token, and sign the player out for doing nothing wrong.
   */
  let refreshing: Promise<string | null> | null = null;

  function refreshOnce(): Promise<string | null> {
    refreshing ??= (tokens?.refresh() ?? Promise.resolve(null)).finally(() => {
      refreshing = null;
    });
    return refreshing;
  }

  async function send(
    method: string,
    path: string,
    body: unknown,
    token: string | null,
  ): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      return await fetch(`${baseUrl}${path}`, {
        method,
        headers: {
          'content-type': 'application/json',
          ...(token ? { authorization: `Bearer ${token}` } : {}),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });
    } catch {
      // A timeout or a dropped connection — the case docs/04 §6 says to expect.
      throw new ApiError('network', 'Could not reach Maidan. Check your connection.');
    } finally {
      clearTimeout(timer);
    }
  }

  async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
    let response = await send(method, path, body, (await tokens?.getAccessToken()) ?? null);

    if (response.status === 401 && tokens) {
      // One retry, and only after a 401. Retrying blind would replay writes; the booking
      // path guards that with an intent id, but nothing else does.
      const renewed = await refreshOnce();
      if (renewed) {
        response = await send(method, path, body, renewed);
      }
      if (response.status === 401) {
        tokens.onSignedOut?.();
        throw new ApiError('unauthorized', 'Sign in to continue');
      }
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
    currentPlayer: () => request<CurrentPlayer>('GET', '/players/me'),
    updateProfile: (input) => request<CurrentPlayer>('PATCH', '/players/me', input),

    // Owner side. Every one of these is refused unless the caller owns the ground.
    listMyVenues: () => request<Venue[]>('GET', '/venues/mine'),
    createVenue: (input) => request<Venue>('POST', '/venues', input),
    updateVenue: (venueId, input) => request<Venue>('PATCH', `/venues/${venueId}`, input),
    addCourt: (venueId, input) => request<Court>('POST', `/venues/${venueId}/courts`, input),
    updateCourt: (courtId, input) => request<Court>('PATCH', `/courts/${courtId}`, input),
    removeCourt: (courtId) => request<void>('DELETE', `/courts/${courtId}`),
    /*
     * Multipart, so this does not go through `request` — that one sets a JSON content type
     * and stringifies the body, and a `FormData` needs neither. The token is attached by
     * hand for the same reason. No refresh-and-retry here: an upload is a single
     * deliberate action a player can repeat, not a background read worth rescuing.
     */
    async uploadVenuePhoto(venueId, file) {
      const form = new FormData();
      form.append('photo', {
        uri: file.uri,
        name: file.fileName,
        type: file.mimeType,
      } as unknown as Blob);

      const token = await tokens?.getAccessToken();
      const response = await fetch(`${baseUrl}/venues/${venueId}/photos`, {
        method: 'POST',
        headers: token ? { authorization: `Bearer ${token}` } : undefined,
        body: form,
      }).catch(() => {
        throw new ApiError('network', 'Could not reach Maidan. Check your connection.');
      });

      const text = await response.text();
      const payload = text ? JSON.parse(text) : null;
      if (!response.ok) {
        throw new ApiError(payload?.error?.code ?? 'network', payload?.error?.message ?? 'Upload failed');
      }

      // Stored as a path; the host is the app's own base URL, which changes when the server
      // moves and must not be baked into a venue record.
      return `${baseUrl}${payload.path}` as string;
    },

    listBlackouts: (venueId) => request<Blackout[]>('GET', `/venues/${venueId}/blackouts`),
    addBlackout: (venueId, input) =>
      request<BlackoutCreated>('POST', `/venues/${venueId}/blackouts`, input),
    removeBlackout: (blackoutId) => request<void>('DELETE', `/blackouts/${blackoutId}`),
    publishVenue: (venueId) => request<Venue>('POST', `/venues/${venueId}/publish`),
    unpublishVenue: (venueId) => request<Venue>('POST', `/venues/${venueId}/unpublish`),

    // Admin. A non-admin gets `not_found`, so these do not announce themselves.
    listVenuesForReview: (status) =>
      request<Venue[]>('GET', `/admin/venues${query({ status })}`),
    approveVenue: (venueId, note) =>
      request<Venue>('POST', `/admin/venues/${venueId}/approve`, { note }),
    rejectVenue: (venueId, note) =>
      request<Venue>('POST', `/admin/venues/${venueId}/reject`, { note }),
    suspendVenue: (venueId, note) =>
      request<Venue>('POST', `/admin/venues/${venueId}/suspend`, { note }),
    listPlayersForAdmin: (search) =>
      request<CurrentPlayer[]>('GET', `/admin/players${query({ query: search })}`),
    setAdmin: (playerId, isAdmin) =>
      request<CurrentPlayer>('POST', `/admin/players/${playerId}/admin`, { isAdmin }),

    // Auth. These are the only calls that work without a token, which is why the server
    // lists their paths as public — everything else 401s before it reaches a handler.
    register: (input) => request<AuthSession>('POST', '/auth/register', input),
    login: (email, password) => request<AuthSession>('POST', '/auth/login', { email, password }),
    requestOtp: (phone) => request<OtpChallenge>('POST', '/auth/otp', { phone }),
    verifyOtp: (phone, code, fullName) =>
      request<AuthSession>('POST', '/auth/otp/verify', { phone, code, fullName }),
    signOut: (refreshToken) => request<void>('POST', '/auth/logout', { refreshToken }),
  };
}
