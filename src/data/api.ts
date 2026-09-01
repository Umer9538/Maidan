/**
 * The API seam.
 *
 * Screens depend on this interface and never on a concrete implementation, so the
 * in-memory mock can be swapped for the real backend without touching a screen. The
 * method signatures deliberately mirror the endpoints described in
 * docs/05-technical-architecture.md — including the slot hold and the idempotency key —
 * so the swap is a transport change, not a redesign.
 */
import type {
  Booking,
  Challenge,
  ChallengeStake,
  ChatThread,
  Amenity,
  City,
  Court,
  CurrentPlayer,
  GenderPreference,
  MatchFormat,
  Message,
  Notification,
  OpenMatch,
  PaymentMode,
  PaymentProvider,
  PeakRule,
  Player,
  Review,
  Rupees,
  SkillLevel,
  Slot,
  Sport,
  Team,
  Venue,
} from '@/domain/types';

export interface VenueFilters {
  sport?: Sport;
  query?: string;
  maxPricePerHour?: number;
}

export interface MatchFilters {
  sport?: Sport;
  skillLevel?: OpenMatch['skillLevel'];
}

/** A slot reservation held during checkout. Expires server-side; the client only displays it. */
export interface SlotHold {
  id: string;
  courtId: string;
  startAt: string;
  endAt: string;
  expiresAt: string;
}

export interface CreateBookingInput {
  /**
   * Client-generated and stable across retries. Pakistani mobile networks drop requests
   * mid-flight and users retry; without this a retry books twice and charges twice.
   */
  intentId: string;
  holdId: string;
  paymentMode: PaymentMode;
  provider: PaymentProvider;
}

export interface SubmitReviewInput {
  bookingId: string;
  /** Whole stars, 1 to 5. */
  rating: number;
  body: string;
}

export interface CreateOpenMatchInput {
  bookingId: string;
  format: MatchFormat;
  /** Total the match needs, host included. */
  playersNeeded: number;
  /** How many are already committed, host included. */
  playersJoined: number;
  skillLevel: SkillLevel;
  genderPreference: GenderPreference;
  note: string | null;
  instantJoin: boolean;
}

export interface CreateChallengeInput {
  challengerTeamId: string;
  /** Null posts it to the open board; a team id aims it at that team. */
  opponentTeamId: string | null;
  format: MatchFormat;
  area: string;
  proposedStartAt: string;
  stake: ChallengeStake;
}

export interface ReportScoreInput {
  challengeId: string;
  /** The reporting captain's team. */
  teamId: string;
  challengerScore: number;
  opponentScore: number;
}

export interface ChallengeResult {
  challenge: Challenge;
  /** True once both captains have reported the same score. */
  settled: boolean;
  /** Set when the two reports disagree — both are kept and neither counts. */
  disputed: boolean;
}

export interface ManualBookingInput {
  venueId: string;
  courtId: string;
  startAt: string;
  /** Who the slot is for. Owners take a name and number at the counter. */
  customerName: string;
  customerPhone: string;
  /** What the owner is charging. Defaults to the court's rate for that slot. */
  price?: Rupees;
}

export interface VenueEarnings {
  /** Bookings that started on the requested PKT day. */
  dayTotal: Rupees;
  /** The seven days ending on the requested day. */
  weekTotal: Rupees;
  /** Taken online through the app, so already ours to settle. */
  collectedOnline: Rupees;
  /** Still owed in cash at the counter. */
  dueAtVenue: Rupees;
  bookingCount: number;
  /** How many of the day's bookings the owner entered by hand. */
  manualCount: number;
}

export interface CreateTeamInput {
  name: string;
  sport: Sport;
  city: City;
  /** Players invited alongside the captain. The captain is added automatically. */
  memberIds: string[];
}

/** Errors the UI must distinguish, rather than showing one generic failure. */
export type VenueStatus = Venue['status'];

export interface CreateVenueInput {
  name: string;
  city: City;
  area: string;
  latitude: number;
  longitude: number;
  /** 24-hour wall clock. Closing may be earlier than opening — grounds here run past midnight. */
  opensAt: string;
  closesAt: string;
  phone?: string;
  about?: string;
  amenities?: Amenity[];
  photos?: string[];
}

export interface CreateCourtInput {
  name: string;
  sport: Sport;
  format: MatchFormat;
  surface?: string;
  indoor?: boolean;
  basePricePerHour: Rupees;
  peakRules?: PeakRule[];
}

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  /** Seconds until the access token expires, counted from when the server replied. */
  expiresIn: number;
  playerId: string;
}

export interface RegisterInput {
  fullName: string;
  email: string;
  phone: string;
  password: string;
}

export interface OtpChallenge {
  /** Normalised to +92XXXXXXXXXX, so the client shows the number the code actually went to. */
  phone: string;
  expiresInSeconds: number;
  /** Development only. There is no SMS provider, so without this the flow cannot complete. */
  devCode?: string;
}

export interface UpdateProfileInput {
  fullName?: string;
  sports?: Sport[];
  city?: City | null;
}

export type ApiErrorCode =
  | 'slot_taken'
  | 'hold_expired'
  | 'not_found'
  | 'payment_failed'
  /** The booking has not been played, so a review would not be a verified one. */
  | 'not_played'
  | 'already_reviewed'
  /** The booking is already open to other players. */
  | 'already_open'
  /** That captain has already reported, or the team is not in this challenge. */
  | 'not_a_captain'
  /** No usable session. The client should refresh its token, then sign in if that fails. */
  | 'unauthorized'
  /** Signed in, but this is not yours to read or change. */
  | 'forbidden'
  /** The email and password do not match an account. Never says which half was wrong. */
  | 'invalid_credentials'
  /** That email or phone number already belongs to an account. */
  | 'already_registered'
  /** Too many attempts. `retryAfterSeconds` says when to try again. */
  | 'rate_limited'
  /** The request was understood and refused. `message` says what to fix and is safe to show. */
  | 'validation'
  | 'network';

export class ApiError extends Error {
  readonly code: ApiErrorCode;

  constructor(code: ApiErrorCode, message: string) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
  }
}

export interface MaidanApi {
  listVenues(filters?: VenueFilters): Promise<Venue[]>;
  /** Reviews for one venue, newest first. Only players with a completed booking leave them. */
  listReviews(venueId: string): Promise<Review[]>;
  getVenue(venueId: string): Promise<Venue>;
  listCourts(venueId: string): Promise<Court[]>;

  /** Availability for one court on one PKT calendar day, priced and status-resolved. */
  listSlots(courtId: string, dayIso: string): Promise<Slot[]>;
  /** Takes the 5-minute hold that keeps the slot off other players' screens. */
  holdSlot(courtId: string, startAt: string): Promise<SlotHold>;
  releaseHold(holdId: string): Promise<void>;

  createBooking(input: CreateBookingInput): Promise<Booking>;
  /**
   * Leaves a review for the venue a completed booking was at.
   *
   * Takes the booking rather than the venue: only a player who actually played can review,
   * which is what "verified reviews" means in docs/04 Pillar 1.
   */
  submitReview(input: SubmitReviewInput): Promise<Review>;
  listBookings(): Promise<Booking[]>;
  /**
   * Every booking at one venue on one PKT day — app and walk-in alike.
   *
   * The owner calendar is only worth anything if it is complete: docs/06 §9 names a stale
   * calendar as the risk that poisons the whole marketplace.
   */
  listVenueBookings(venueId: string, dayIso: string): Promise<Booking[]>;
  /**
   * Records a booking the owner took at the counter or over the phone.
   *
   * Goes through the same slot check as an app booking. One source of truth (docs/05
   * §5.1): a walk-in that bypassed it would let the same court be sold twice.
   */
  createManualBooking(input: ManualBookingInput): Promise<Booking>;
  /** Day and week takings for one venue, split by how they were paid. */
  getVenueEarnings(venueId: string, dayIso: string): Promise<VenueEarnings>;
  getBooking(bookingId: string): Promise<Booking>;
  cancelBooking(bookingId: string): Promise<Booking>;

  /**
   * Opens a booking up to other players.
   *
   * Takes the booking, not a venue and a time: an open match is a slot someone has already
   * paid to hold. That is what stops the feed filling with matches at courts nobody booked.
   */
  createOpenMatch(input: CreateOpenMatchInput): Promise<OpenMatch>;
  listOpenMatches(filters?: MatchFilters): Promise<OpenMatch[]>;
  /** Matches the current player has joined, including ones that have since filled. */
  listMyMatches(): Promise<OpenMatch[]>;
  getOpenMatch(matchId: string): Promise<OpenMatch>;
  requestToJoinMatch(matchId: string): Promise<OpenMatch>;

  /** The open board: challenges nobody has accepted yet. */
  listChallenges(): Promise<Challenge[]>;
  /**
   * Challenges involving one of the current player's teams, whatever their status.
   *
   * Separate from the board because an accepted challenge leaves the board — without this
   * a captain would lose sight of a match the moment it was agreed.
   */
  listMyChallenges(): Promise<Challenge[]>;
  getChallenge(challengeId: string): Promise<Challenge>;
  /** Posts a challenge — open to the board, or aimed at one team. */
  createChallenge(input: CreateChallengeInput): Promise<Challenge>;
  /**
   * Records one captain's score.
   *
   * The result is only settled, and the leaderboard only moves, once both captains have
   * reported the same score (docs/04, Pillar 3). One captain reporting alone proves nothing.
   */
  reportScore(input: ReportScoreInput): Promise<ChallengeResult>;
  acceptChallenge(challengeId: string): Promise<Challenge>;
  listTeams(): Promise<Team[]>;
  /**
   * Creates a team with the current player as captain.
   *
   * Without this there is no way into Pillar 3 at all: challenges need a team, and a new
   * player has none.
   */
  createTeam(input: CreateTeamInput): Promise<Team>;
  getTeam(teamId: string): Promise<Team>;

  listThreads(): Promise<ChatThread[]>;
  listMessages(threadId: string): Promise<Message[]>;
  sendMessage(threadId: string, body: string): Promise<Message>;

  listNotifications(): Promise<Notification[]>;
  getPlayer(playerId: string): Promise<Player>;
  /** Players by id, in the order given. Unknown ids are dropped rather than throwing. */
  listPlayers(playerIds: string[]): Promise<Player[]>;
  /** Players matching a name fragment, for the invite sheet. Empty query returns everyone. */
  searchPlayers(query: string): Promise<Player[]>;
  /** The signed-in player's own record, including setup state and any venues they manage. */
  currentPlayer(): Promise<CurrentPlayer>;

  /** Saves the setup choices and the profile fields that share a screen with them. */
  updateProfile(input: UpdateProfileInput): Promise<CurrentPlayer>;

  // ---------------------------------------------------------------------- owner side --
  //
  // Listing a ground and saying how big it is. A new venue is `pending` and nothing on it
  // is bookable — in the app or at the counter — until MAIDAN approves it, so these calls
  // put a listing into review rather than into the marketplace.

  /** The caller's own grounds, whatever their status. Discovery only ever returns `live`. */
  listMyVenues(): Promise<Venue[]>;
  createVenue(input: CreateVenueInput): Promise<Venue>;
  updateVenue(venueId: string, input: Partial<CreateVenueInput>): Promise<Venue>;
  addCourt(venueId: string, input: CreateCourtInput): Promise<Court>;
  updateCourt(courtId: string, input: Partial<CreateCourtInput>): Promise<Court>;
  removeCourt(courtId: string): Promise<void>;
  /** Approved grounds only, and only once there is a court to book. */
  publishVenue(venueId: string): Promise<Venue>;
  /** Stops sales at once — a refit, a closed season. Bookings already made stand. */
  unpublishVenue(venueId: string): Promise<Venue>;

  // --------------------------------------------------------------------------- admin --

  listVenuesForReview(status: VenueStatus): Promise<Venue[]>;
  approveVenue(venueId: string, note?: string): Promise<Venue>;
  /** The note is required: a rejection with no reason leaves an owner nothing to act on. */
  rejectVenue(venueId: string, note: string): Promise<Venue>;

  // ------------------------------------------------------------------------------ auth --
  //
  // Auth sits on the same interface as everything else so the app never asks which backend
  // it has. The mock signs people in against its own memory; the HTTP client calls the
  // server. `AuthProvider` calls these and cannot tell the difference — which is what keeps
  // the whole app runnable with no network.

  register(input: RegisterInput): Promise<AuthSession>;
  login(email: string, password: string): Promise<AuthSession>;
  /** Sends a code. Outside production the code comes back on the response, since no SMS is sent. */
  requestOtp(phone: string): Promise<OtpChallenge>;
  verifyOtp(phone: string, code: string, fullName?: string): Promise<AuthSession>;
  /** Ends the session server-side. Local state is cleared whether or not this succeeds. */
  signOut(refreshToken: string): Promise<void>;
}
