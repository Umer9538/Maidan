/**
 * Row → domain object.
 *
 * Kept in one place so the wire format is defined once. The client's `@/domain/types` are
 * the contract; these functions are the only thing that knows about column names.
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
  Team,
  Venue,
} from '@/domain/types';

type Row = Record<string, any>;

export function toPlayer(row: Row): Player {
  return {
    id: row.id,
    name: row.full_name,
    avatarUrl: row.avatar_url,
    reliability: row.reliability,
    gamesPlayed: row.games_played,
    skillBySport: row.skill_by_sport ?? {},
  };
}

export function toVenue(row: Row): Venue {
  return {
    id: row.id,
    ownerId: row.owner_id,
    name: row.name,
    city: row.city,
    area: row.area,
    geo: { latitude: row.latitude, longitude: row.longitude },
    sports: row.sports ?? [],
    amenities: row.amenities ?? [],
    photos: row.photos ?? [],
    about: row.about,
    hours: { opensAt: row.opens_at, closesAt: row.closes_at },
    fromPricePerHour: row.from_price_per_hour,
    phone: row.phone,
    rating: row.rating,
    reviewCount: row.review_count,
    playerCount: row.player_count,
    status: row.status,
    cancellationPolicyId: 'standard',
  };
}

export function toCourt(row: Row): Court {
  return {
    id: row.id,
    venueId: row.venue_id,
    name: row.name,
    sport: row.sport,
    format: row.format,
    surface: row.surface,
    indoor: row.indoor,
    basePricePerHour: row.base_price_per_hour,
    peakRules: row.peak_rules ?? [],
  };
}

export function toBooking(row: Row): Booking {
  return {
    id: row.id,
    intentId: row.intent_id,
    courtId: row.court_id,
    venueId: row.venue_id,
    userId: row.user_id,
    teamId: row.team_id,
    startAt: row.start_at.toISOString(),
    endAt: row.end_at.toISOString(),
    status: row.status,
    total: row.total,
    paidOnline: row.paid_online,
    dueAtVenue: row.due_at_venue,
    paymentMode: row.payment_mode,
    provider: row.provider,
    source: row.source,
    cancellationPolicy: row.cancellation_policy,
    code: row.code,
    customer: row.customer_name
      ? { name: row.customer_name, phone: row.customer_phone ?? '' }
      : null,
    createdAt: row.created_at.toISOString(),
  };
}

export function toOpenMatch(row: Row): OpenMatch {
  return {
    id: row.id,
    bookingId: row.booking_id,
    hostId: row.host_id,
    venueId: row.venue_id,
    courtId: row.court_id,
    sport: row.sport,
    format: row.format,
    startAt: row.start_at.toISOString(),
    playersNeeded: row.players_needed,
    playersJoined: row.players_joined,
    skillLevel: row.skill_level,
    genderPreference: row.gender_preference,
    pricePerPlayer: row.price_per_player,
    note: row.note,
    instantJoin: row.instant_join,
    status: row.status,
  };
}

export function toTeam(row: Row): Team {
  return {
    id: row.id,
    name: row.name,
    sport: row.sport,
    city: row.city,
    crestUrl: row.crest_url,
    captainId: row.captain_id,
    wins: row.wins,
    losses: row.losses,
    cityRank: row.city_rank,
    memberIds: row.member_ids ?? [],
  };
}

export function toChallenge(row: Row): Challenge {
  return {
    id: row.id,
    type: row.type,
    challengerTeamId: row.challenger_team_id,
    opponentTeamId: row.opponent_team_id,
    sport: row.sport,
    format: row.format,
    area: row.area,
    proposedStartAt: row.proposed_start_at.toISOString(),
    stake: row.stake,
    status: row.status,
    agreedBookingId: row.agreed_booking_id,
    reportedScores: row.reported_scores ?? {},
  };
}

export function toThread(row: Row): ChatThread {
  return {
    id: row.id,
    kind: row.kind,
    title: row.title,
    subtitle: row.subtitle,
    avatarUrl: row.avatar_url,
    lastMessage: row.last_message,
    lastMessageAt: row.last_message_at.toISOString(),
    unreadCount: row.unread ?? 0,
    memberIds: row.member_ids ?? [],
    venueId: row.venue_id,
  };
}

export function toMessage(row: Row, currentUserId: string): Message {
  return {
    id: row.id,
    threadId: row.thread_id,
    authorId: row.author_id,
    authorName: row.author_name,
    body: row.body,
    sentAt: row.sent_at.toISOString(),
    mine: row.author_id === currentUserId,
  };
}

export function toReview(row: Row): Review {
  return {
    id: row.id,
    venueId: row.venue_id,
    bookingId: row.booking_id,
    authorId: row.author_id,
    authorName: row.author_name,
    authorAvatarUrl: row.author_avatar_url,
    rating: row.rating,
    body: row.body,
    createdAt: row.created_at.toISOString(),
  };
}

export function toNotification(row: Row): Notification {
  return {
    id: row.id,
    kind: row.kind,
    actorName: row.actor_name,
    actorAvatarUrl: row.actor_avatar,
    body: row.body,
    createdAt: row.created_at.toISOString(),
    read: row.read,
    decision: row.target_id ? { targetId: row.target_id } : null,
  };
}
