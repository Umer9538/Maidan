/**
 * Query keys and hooks.
 *
 * Keys are built through `queryKeys` rather than written inline, so an invalidation after
 * a booking cannot silently miss a list because two call sites spelled the key differently.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { PaymentMode, PaymentProvider } from '@/domain/types';

import type {
  CreateChallengeInput,
  CreateTeamInput,
  CreateOpenMatchInput,
  ManualBookingInput,
  MatchFilters,
  ReportScoreInput,
  VenueFilters,
} from './api';
import { useApi } from './provider';

export const queryKeys = {
  venues: (filters?: VenueFilters) => ['venues', filters ?? {}] as const,
  venue: (venueId: string) => ['venue', venueId] as const,
  reviews: (venueId: string) => ['reviews', venueId] as const,
  courts: (venueId: string) => ['courts', venueId] as const,
  slots: (courtId: string, day: string) => ['slots', courtId, day] as const,
  bookings: () => ['bookings'] as const,
  venueBookings: (venueId: string, day: string) => ['venue-bookings', venueId, day] as const,
  venueEarnings: (venueId: string, day: string) => ['venue-earnings', venueId, day] as const,
  booking: (bookingId: string) => ['booking', bookingId] as const,
  matches: (filters?: MatchFilters) => ['matches', filters ?? {}] as const,
  myMatches: () => ['matches', 'mine'] as const,
  match: (matchId: string) => ['match', matchId] as const,
  challenges: () => ['challenges'] as const,
  myChallenges: () => ['challenges', 'mine'] as const,
  challenge: (challengeId: string) => ['challenge', challengeId] as const,
  teams: () => ['teams'] as const,
  team: (teamId: string) => ['team', teamId] as const,
  threads: () => ['threads'] as const,
  messages: (threadId: string) => ['messages', threadId] as const,
  notifications: () => ['notifications'] as const,
  currentPlayer: () => ['player', 'me'] as const,
  player: (playerId: string) => ['player', playerId] as const,
  players: (playerIds: string[]) => ['players', playerIds] as const,
};

export function useVenues(filters?: VenueFilters) {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.venues(filters),
    queryFn: () => api.listVenues(filters),
  });
}

export function useVenue(venueId: string) {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.venue(venueId),
    queryFn: () => api.getVenue(venueId),
    enabled: Boolean(venueId),
  });
}

export function useReviews(venueId: string) {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.reviews(venueId),
    queryFn: () => api.listReviews(venueId),
    enabled: Boolean(venueId),
  });
}

export function useCourts(venueId: string) {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.courts(venueId),
    queryFn: () => api.listCourts(venueId),
    enabled: Boolean(venueId),
  });
}

export function useSlots(courtId: string | undefined, day: string) {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.slots(courtId ?? '', day),
    queryFn: () => api.listSlots(courtId as string, day),
    enabled: Boolean(courtId),
    // Availability is the one thing that must not be stale — someone else may be
    // checking out for this slot right now.
    staleTime: 10_000,
    refetchInterval: 30_000,
  });
}

export function useBookings() {
  const api = useApi();
  return useQuery({ queryKey: queryKeys.bookings(), queryFn: () => api.listBookings() });
}

export function useVenueBookings(venueId: string, day: string) {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.venueBookings(venueId, day),
    queryFn: () => api.listVenueBookings(venueId, day),
    enabled: Boolean(venueId),
    // The counter is the source of truth for a busy evening; keep it close to live.
    staleTime: 10_000,
  });
}

export function useVenueEarnings(venueId: string, day: string) {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.venueEarnings(venueId, day),
    queryFn: () => api.getVenueEarnings(venueId, day),
    enabled: Boolean(venueId),
  });
}

export function useCreateManualBooking() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ManualBookingInput) => api.createManualBooking(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['venue-bookings'] });
      queryClient.invalidateQueries({ queryKey: ['venue-earnings'] });
      // The player-facing grid must show the slot gone straight away.
      queryClient.invalidateQueries({ queryKey: ['slots'] });
    },
  });
}

export function useBooking(bookingId: string) {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.booking(bookingId),
    queryFn: () => api.getBooking(bookingId),
    enabled: Boolean(bookingId),
  });
}

export function useHoldSlot() {
  const api = useApi();
  return useMutation({
    mutationFn: ({ courtId, startAt }: { courtId: string; startAt: string }) =>
      api.holdSlot(courtId, startAt),
  });
}

export function useReleaseHold() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (holdId: string) => api.releaseHold(holdId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['slots'] }),
  });
}

export function useCreateBooking() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      intentId: string;
      holdId: string;
      paymentMode: PaymentMode;
      provider: PaymentProvider;
    }) => api.createBooking(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.bookings() });
      queryClient.invalidateQueries({ queryKey: ['slots'] });
    },
  });
}

export function useSubmitReview() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { bookingId: string; rating: number; body: string }) =>
      api.submitReview(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['reviews'] }),
  });
}

export function useSearchPlayers(query: string) {
  const api = useApi();
  return useQuery({
    queryKey: ['players', 'search', query] as const,
    queryFn: () => api.searchPlayers(query),
  });
}

export function useOpenMatches(filters?: MatchFilters) {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.matches(filters),
    queryFn: () => api.listOpenMatches(filters),
  });
}

export function useOpenMatch(matchId: string) {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.match(matchId),
    queryFn: () => api.getOpenMatch(matchId),
    enabled: Boolean(matchId),
  });
}

export function useMyMatches() {
  const api = useApi();
  return useQuery({ queryKey: queryKeys.myMatches(), queryFn: () => api.listMyMatches() });
}

export function useCreateOpenMatch() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateOpenMatchInput) => api.createOpenMatch(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['matches'] }),
  });
}

export function useJoinMatch() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (matchId: string) => api.requestToJoinMatch(matchId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['matches'] }),
  });
}

export function useChallenges() {
  const api = useApi();
  return useQuery({ queryKey: queryKeys.challenges(), queryFn: () => api.listChallenges() });
}

export function useMyChallenges() {
  const api = useApi();
  return useQuery({ queryKey: queryKeys.myChallenges(), queryFn: () => api.listMyChallenges() });
}

export function useChallenge(challengeId: string) {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.challenge(challengeId),
    queryFn: () => api.getChallenge(challengeId),
    enabled: Boolean(challengeId),
  });
}

export function useCreateChallenge() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateChallengeInput) => api.createChallenge(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.challenges() }),
  });
}

export function useReportScore() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ReportScoreInput) => api.reportScore(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.challenges() });
      queryClient.invalidateQueries({ queryKey: queryKeys.teams() });
    },
  });
}

export function useAcceptChallenge() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (challengeId: string) => api.acceptChallenge(challengeId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.challenges() }),
  });
}

export function useTeams() {
  const api = useApi();
  return useQuery({ queryKey: queryKeys.teams(), queryFn: () => api.listTeams() });
}

export function useCreateTeam() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateTeamInput) => api.createTeam(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.teams() }),
  });
}

export function useCancelBooking() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (bookingId: string) => api.cancelBooking(bookingId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.bookings() });
      // The slot goes back on sale the moment it is released.
      queryClient.invalidateQueries({ queryKey: ['slots'] });
      queryClient.invalidateQueries({ queryKey: ['venue-bookings'] });
    },
  });
}

export function useThreads() {
  const api = useApi();
  return useQuery({ queryKey: queryKeys.threads(), queryFn: () => api.listThreads() });
}

export function useMessages(threadId: string) {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.messages(threadId),
    queryFn: () => api.listMessages(threadId),
    enabled: Boolean(threadId),
  });
}

export function useSendMessage(threadId: string) {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: string) => api.sendMessage(threadId, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.messages(threadId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.threads() });
    },
  });
}

export function useNotifications() {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.notifications(),
    queryFn: () => api.listNotifications(),
  });
}

export function usePlayer(playerId: string | undefined) {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.player(playerId ?? ''),
    queryFn: () => api.getPlayer(playerId as string),
    enabled: Boolean(playerId),
  });
}

export function usePlayers(playerIds: string[]) {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.players(playerIds),
    queryFn: () => api.listPlayers(playerIds),
    enabled: playerIds.length > 0,
  });
}

export function useCurrentPlayer() {
  const api = useApi();
  return useQuery({ queryKey: queryKeys.currentPlayer(), queryFn: () => api.currentPlayer() });
}
