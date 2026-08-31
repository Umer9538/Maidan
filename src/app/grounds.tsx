/**
 * All grounds — frame `16_See All Events`.
 *
 * Measured: title at y73, then compact 327x78 cards from y120 with a 14pt gap. It is the
 * same row as the matches feed and the challenge board, which is the point — one card
 * shape across every list in the app.
 *
 * Reached from Home's "View all", and from a sport pill, which arrives as `?sport=`.
 */
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, View } from 'react-native';

import { AppBar, EmptyState, ListCard, PillGroup, Screen } from '@/components/ui';
import { useVenues } from '@/data/queries';
import { SPORT_LABELS } from '@/domain/labels';
import type { Sport, Venue } from '@/domain/types';
import { formatPkr } from '@/lib/money';
import { useGoBack } from '@/lib/navigation';
import { colors, s, spacing } from '@/theme';

const SPORTS = (['padel', 'futsal', 'cricket'] as const).map((sport) => ({
  value: sport,
  label: SPORT_LABELS[sport],
}));

export default function GroundsScreen() {
  const router = useRouter();
  const goBack = useGoBack('/(tabs)');
  const params = useLocalSearchParams<{ sport?: Sport }>();
  const [sport, setSport] = useState<Sport | null>(params.sport ?? null);

  const venues = useVenues(sport ? { sport } : undefined);

  const renderVenue = (venue: Venue) => (
    <ListCard
      id={venue.id}
      title={venue.name}
      metaLeft={venue.sports.map((each) => SPORT_LABELS[each]).join(' · ')}
      metaRight={venue.area}
      photoUri={venue.photos[0]}
      price={formatPkr(venue.fromPricePerHour)}
      action="Book"
      onPress={() => router.push(`/venue/${venue.id}`)}
      testID={`ground-${venue.id}`}
    />
  );

  return (
    <Screen>
      <AppBar
        title="All grounds"
        onBack={goBack}
        actions={[
          {
            icon: 'search',
            accessibilityLabel: 'Search grounds',
            onPress: () => router.push('/search'),
          },
        ]}
      />

      <View style={styles.filters}>
        <PillGroup
          options={SPORTS}
          value={sport}
          onChange={(next) => setSport((current) => (current === next ? null : next))}
          testID="grounds-sport"
        />
      </View>

      {venues.isPending ? (
        <ActivityIndicator style={styles.loader} color={colors.orange} />
      ) : (
        <FlatList
          data={venues.data ?? []}
          keyExtractor={(venue) => venue.id}
          renderItem={({ item }) => renderVenue(item)}
          ItemSeparatorComponent={() => <View style={styles.gap} />}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshing={venues.isFetching}
          onRefresh={venues.refetch}
          ListEmptyComponent={
            <EmptyState
              icon="location"
              title="No grounds for that sport"
              body="Nothing is live in Lahore for this sport yet. Try another, or clear the filter."
            />
          }
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  filters: { paddingHorizontal: spacing.gutter, paddingBottom: spacing.lg },
  list: { paddingHorizontal: spacing.gutter, paddingBottom: spacing.xxl, flexGrow: 1 },
  gap: { height: s(14) },
  loader: { marginTop: s(48) },
});
