/**
 * Open Matches — Pillar 2's feed. A direct port of the `Open Matches` frame (node 1:239):
 * app bar, then eight 327x78 cards with a per-player price and a JOIN NOW action.
 */
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, View } from 'react-native';

import { AppBar, EmptyState, ListCard, PillGroup, Screen } from '@/components/ui';
import { useOpenMatches, useVenues } from '@/data/queries';
import { SPORT_LABELS, matchTitle } from '@/domain/labels';
import type { OpenMatch, Sport } from '@/domain/types';
import { formatSlotShort } from '@/lib/datetime';
import { formatPkr } from '@/lib/money';
import { colors, spacing } from '@/theme';

const SPORT_FILTERS: { value: Sport; label: string }[] = (
  ['padel', 'futsal', 'cricket'] as const
).map((sport) => ({ value: sport, label: SPORT_LABELS[sport] }));

export default function MatchesScreen() {
  const router = useRouter();
  const [sport, setSport] = useState<Sport | null>(null);

  const matches = useOpenMatches(sport ? { sport } : undefined);
  const venues = useVenues();

  /** Area and photo live on the venue, so the feed is joined client-side here. */
  const venueById = useMemo(
    () => new Map((venues.data ?? []).map((venue) => [venue.id, venue])),
    [venues.data],
  );

  const renderCard = (match: OpenMatch) => {
    const venue = venueById.get(match.venueId);
    return (
      <ListCard
        id={match.id}
        title={matchTitle(match.format, match.playersNeeded, match.playersJoined)}
        // Time then area, as the frame's sub-line reads. Skill stays out of it: three
        // values in a 170px column truncate, and skill is what the filter above is for.
        metaLeft={formatSlotShort(match.startAt)}
        metaRight={venue?.area}
        photoUri={venue?.photos[0]}
        // The picture is the ground's, so the monogram behind it has to be too.
        photoName={venue?.name}
        price={formatPkr(match.pricePerPlayer)}
        action="Join now"
        accessibilityHint="Opens the match"
        // Joining costs money, so the card opens the match rather than committing to it.
        onPress={() => router.push(`/match/${match.id}`)}
        testID={`match-${match.id}`}
      />
    );
  };

  return (
    <Screen>
      <AppBar
        title="Open Matches"
        onBack={router.canGoBack() ? router.back : undefined}
        actions={[{ icon: 'search', accessibilityLabel: 'Search matches' }]}
      />

      <View style={styles.filters}>
        <PillGroup
          options={SPORT_FILTERS}
          value={sport}
          onChange={(value) => setSport((current) => (current === value ? null : value))}
          testID="match-sport-filter"
        />
      </View>

      {matches.isPending ? (
        <ActivityIndicator style={styles.loader} color={colors.orange} />
      ) : (
        <FlatList
          data={matches.data ?? []}
          keyExtractor={(match) => match.id}
          renderItem={({ item }) => renderCard(item)}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={styles.gap} />}
          showsVerticalScrollIndicator={false}
          refreshing={matches.isFetching}
          onRefresh={matches.refetch}
          ListEmptyComponent={
            <EmptyState
              icon="users"
              title="No open matches yet"
              body="Nothing needs players in this filter right now. Book a slot and open it up — the feed fills fastest in the evening."
            />
          }
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  filters: { paddingHorizontal: spacing.gutter, paddingBottom: spacing.lg },
  list: { paddingHorizontal: spacing.gutter, paddingBottom: spacing.xxl },
  gap: { height: 14 },
  loader: { marginTop: 48 },
});
