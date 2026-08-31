/**
 * Domain model. Mirrors the tables in docs/05-technical-architecture.md §4 so the
 * client and the eventual Postgres schema stay recognisably the same shape.
 *
 * Money is held as a whole number of rupees (`Rupees`). Pakistani facility pricing is
 * quoted in whole rupees and never in paisa, so a float here would only invite
 * rounding drift when a booking is split N ways.
 */

/** A whole number of Pakistani rupees. */
export type Rupees = number;

/** ISO-8601 instant, e.g. `2026-09-02T21:00:00+05:00`. */
export type Timestamp = string;

export type Sport = 'padel' | 'futsal' | 'cricket';

/** Playing format. Which values are valid depends on the sport — see `FORMATS_BY_SPORT`. */
export type MatchFormat =
  | 'padel_singles'
  | 'padel_doubles'
  | 'futsal_5v5'
  | 'futsal_6v6'
  | 'futsal_7v7'
  | 'cricket_box'
  | 'cricket_tape_ball'
  | 'cricket_nets';

/**
 * Self-declared at MVP. docs/04 §4 defers the computed Playtomic-style level, so the
 * type stays deliberately coarse rather than pretending to a numeric rating.
 */
export type SkillLevel = 'beginner' | 'intermediate' | 'advanced';

/**
 * Required by the market, not an afterthought — docs/07 §4. A match host must be able
 * to state who may join.
 */
export type GenderPreference = 'anyone' | 'men' | 'women';

export type City = 'lahore' | 'karachi' | 'islamabad';

export interface Venue {
  id: string;
  ownerId: string;
  name: string;
  city: City;
  /** Neighbourhood, e.g. "DHA Phase 5". This is how players actually navigate. */
  area: string;
  geo: { latitude: number; longitude: number };
  sports: Sport[];
  amenities: Amenity[];
  /** Hero and gallery. The card thumbnail is `photos[0]`; never a glyph. */
  photos: string[];
  about: string;
  /** Local clock, 24h, e.g. `{ opensAt: '09:00', closesAt: '02:00' }` — closing may wrap past midnight. */
  hours: { opensAt: string; closesAt: string };
  /** Lowest court price at the venue, for the list card. */
  fromPricePerHour: Rupees;
  /**
   * The venue's public counter number, in international form.
   *
   * Player-to-player numbers are never exposed (docs/05 §6), but a venue's own line is
   * already public — it is how bookings happen today (docs/01 §6) — and the booked-details
   * screen offers it for the "I am at the gate and it is locked" case.
   */
  phone: string;
  rating: number | null;
  reviewCount: number;
  playerCount: number;
  status: 'pending' | 'verified' | 'live';
  cancellationPolicyId: string;
}

export type Amenity =
  | 'parking'
  | 'washrooms'
  | 'showers'
  | 'seating'
  | 'equipment_rental'
  | 'prayer_area'
  | 'cafe'
  | 'floodlights'
  | 'female_friendly_timings';

export interface Court {
  id: string;
  venueId: string;
  name: string;
  sport: Sport;
  format: MatchFormat;
  surface: string;
  indoor: boolean;
  basePricePerHour: Rupees;
  /** Peak windows override the base price. Night play is peak in Pakistan's heat. */
  peakRules: PeakRule[];
}

export interface PeakRule {
  /** 0 = Sunday, matching `Date#getDay`. Empty means every day. */
  daysOfWeek: number[];
  /** Local clock, inclusive of `from`, exclusive of `to`. May wrap past midnight. */
  from: string;
  to: string;
  pricePerHour: Rupees;
}

/** A bookable window on one court, priced and with its availability resolved. */
export interface Slot {
  courtId: string;
  startAt: Timestamp;
  endAt: Timestamp;
  price: Rupees;
  /** `held` means another player is in checkout — see the 5-minute hold in docs/05 §5.1. */
  status: 'available' | 'held' | 'booked' | 'blocked';
  isPeak: boolean;
}

export type BookingStatus =
  'pending' | 'confirmed' | 'checked_in' | 'completed' | 'cancelled' | 'no_show';

/**
 * `deposit` is the default for futsal and cricket: a small online advance kills the
 * no-show while the balance stays cash at the counter, which is how ~75-85% of
 * Pakistani commerce actually settles (docs/03 §1.1).
 */
export type PaymentMode = 'full_prepay' | 'deposit';

export type PaymentProvider = 'jazzcash' | 'easypaisa' | 'card';

/**
 * A card the player has saved.
 *
 * Deliberately holds no card number, no CVV and no expiry beyond the month — PCI scope
 * stays with the gateway (docs/05 §6). `token` is the gateway's handle for the card; the
 * app never sees the pan again after entry.
 */
export interface SavedCard {
  id: string;
  token: string;
  brand: string;
  last4: string;
  expiryMonth: number;
  expiryYear: number;
  isPrimary: boolean;
}

export interface Booking {
  id: string;
  /** Client-generated, so a retry on a flaky network cannot double-book or double-charge. */
  intentId: string;
  courtId: string;
  venueId: string;
  userId: string;
  teamId: string | null;
  startAt: Timestamp;
  endAt: Timestamp;
  status: BookingStatus;
  total: Rupees;
  paidOnline: Rupees;
  /** What is still owed in cash at the counter. */
  dueAtVenue: Rupees;
  paymentMode: PaymentMode;
  provider: PaymentProvider | null;
  source: 'app' | 'manual';
  /**
   * The policy as it stood when the booking was made. Snapshotted because a later
   * policy change must never retroactively alter an existing booking (docs/05 §5.2).
   */
  cancellationPolicy: CancellationPolicy;
  /** Short human-readable code shown at the counter. */
  code: string;
  /**
   * Who the slot is for, when the owner entered it by hand.
   *
   * Walk-ins have no Maidan account, so the name and number the owner takes at the counter
   * is all the identity there is. Null for app bookings, where the player is the user.
   */
  customer: { name: string; phone: string } | null;
  createdAt: Timestamp;
}

export interface CancellationPolicy {
  id: string;
  label: string;
  /** Evaluated in order; the first rule whose window still contains "now" wins. */
  tiers: { hoursBefore: number; refundPercent: number }[];
}

export interface OpenMatch {
  id: string;
  bookingId: string;
  hostId: string;
  venueId: string;
  courtId: string;
  sport: Sport;
  format: MatchFormat;
  startAt: Timestamp;
  /** Total the match needs, including the host and everyone already committed. */
  playersNeeded: number;
  playersJoined: number;
  skillLevel: SkillLevel;
  genderPreference: GenderPreference;
  /** Derived from the booking total divided by `playersNeeded`. */
  pricePerPlayer: Rupees;
  note: string | null;
  /** When true a request is auto-approved rather than queued for the host. */
  instantJoin: boolean;
  status: 'open' | 'full' | 'cancelled' | 'played';
}

export interface MatchPlayer {
  matchId: string;
  userId: string;
  status: 'requested' | 'approved' | 'paid' | 'attended' | 'no_show';
}

export interface Team {
  id: string;
  name: string;
  sport: Sport;
  city: City;
  crestUrl: string | null;
  captainId: string;
  wins: number;
  losses: number;
  /** Rank within the team's own city and sport. Null until the team has a record. */
  cityRank: number | null;
  memberIds: string[];
}

/** What the loser owes. Stakes are social, not held by us — we never escrow a wager. */
export type ChallengeStake = 'split_cost' | 'loser_pays';

export interface Challenge {
  id: string;
  type: 'open' | 'direct';
  challengerTeamId: string;
  /** Null while an open challenge is still on the board. */
  opponentTeamId: string | null;
  sport: Sport;
  format: MatchFormat;
  area: string;
  proposedStartAt: Timestamp;
  stake: ChallengeStake;
  status: 'open' | 'accepted' | 'booked' | 'played' | 'cancelled';
  agreedBookingId: string | null;
  /** The leaderboard only moves once both captains report the same score. */
  reportedScores: Record<string, { challenger: number; opponent: number }>;
}

export interface Player {
  id: string;
  name: string;
  avatarUrl: string | null;
  /** Derived from attendance events. Shown next to the name; drives the no-show system. */
  reliability: number;
  gamesPlayed: number;
  skillBySport: Partial<Record<Sport, SkillLevel>>;
}

export type ThreadKind = 'match' | 'team' | 'venue';

export interface ChatThread {
  id: string;
  kind: ThreadKind;
  title: string;
  subtitle: string | null;
  avatarUrl: string | null;
  lastMessage: string;
  lastMessageAt: Timestamp;
  unreadCount: number;
  /** Everyone in the conversation, including the current user. */
  memberIds: string[];
  /** The ground the conversation is about, when there is one. Drives the photo grid. */
  venueId: string | null;
}

export interface Message {
  id: string;
  threadId: string;
  authorId: string;
  authorName: string;
  body: string;
  sentAt: Timestamp;
  /** True when the current user wrote it — orange bubble, right-aligned. */
  mine: boolean;
}

/**
 * A venue review.
 *
 * Only a player with a completed booking can leave one (docs/04, Pillar 1) — `bookingId`
 * is what makes the review verified rather than anonymous noise, so it is required.
 */
export interface Review {
  id: string;
  venueId: string;
  bookingId: string;
  authorId: string;
  authorName: string;
  authorAvatarUrl: string | null;
  /** Whole stars, 1 to 5. */
  rating: number;
  body: string;
  createdAt: Timestamp;
}

export interface Notification {
  id: string;
  kind: 'join_request' | 'challenge' | 'booking' | 'system';
  actorName: string;
  actorAvatarUrl: string | null;
  body: string;
  createdAt: Timestamp;
  read: boolean;
  /** Present when the notification is waiting on the user to accept or reject. */
  decision: { targetId: string } | null;
}
