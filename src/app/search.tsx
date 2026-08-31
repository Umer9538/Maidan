/**
 * Search — frame `24_Search- White Bar`.
 *
 * Measured from the export: title at y75, the search row at y119 (54 tall — the field at
 * 21..300 with a 54pt filter button at 300..354), the category chip rail at y183 (51
 * tall), and the 327x78 result cards from y250.
 *
 * The frame searches events by name. Ours searches grounds by name *and area*, because
 * "Johar Town" is how a player in Lahore actually looks for a court — docs/01 §6.
 */
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/icons';
import {
  AppBar,
  EmptyState,
  ListCard,
  PillGroup,
  PressableScale,
  Screen,
  SearchBar,
} from '@/components/ui';
import { useVenues } from '@/data/queries';
import {
  EMPTY_FILTERS,
  FilterSheet,
  isFiltered,
  type DiscoveryFilters,
} from '@/features/discovery/filter-sheet';
import { SPORT_LABELS } from '@/domain/labels';
import type { Sport, Venue } from '@/domain/types';
import { formatPkr } from '@/lib/money';
import { useGoBack } from '@/lib/navigation';
import { colors, radius, s, spacing } from '@/theme';

const SPORTS = (['padel', 'futsal', 'cricket'] as const).map((sport) => ({
  value: sport,
  label: SPORT_LABELS[sport],
}));

export default function SearchScreen() {
  const router = useRouter();
  const goBack = useGoBack('/(tabs)');
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<DiscoveryFilters>(EMPTY_FILTERS);
  const [sheetOpen, setSheetOpen] = useState(false);

  // Unfiltered, so the sheet's histogram shows the whole market rather than the slice
  // already selected — a distribution that moves as you drag the thumb is unreadable.
  const allVenues = useVenues();
  const results = useVenues({
    sport: filters.sport ?? undefined,
    query: query || undefined,
    maxPricePerHour: filters.maxPricePerHour,
  });

  const distribution = useMemo(
    () => (allVenues.data ?? []).map((venue) => venue.fromPricePerHour),
    [allVenues.data],
  );

  const renderVenue = (venue: Venue) => (
    <ListCard
      id={venue.id}
      title={venue.name}
      metaLeft={venue.sports.map((sport) => SPORT_LABELS[sport]).join(' · ')}
      metaRight={venue.area}
      photoUri={venue.photos[0]}
      price={formatPkr(venue.fromPricePerHour)}
      action="Book"
      onPress={() => router.push(`/venue/${venue.id}`)}
      testID={`result-${venue.id}`}
    />
  );

  return (
    <Screen>
      <AppBar
        title="Search"
        onBack={goBack}
        actions={[
          {
            icon: 'location',
            accessibilityLabel: 'View results on the map',
            onPress: () => router.push('/map'),
          },
        ]}
      />

      <View style={styles.searchRow}>
        <View style={styles.searchField}>
          <SearchBar
            value={query}
            onChangeText={setQuery}
            placeholder="Find a ground or area"
            testID="search-input"
          />
        </View>
        <PressableScale
          onPress={() => setSheetOpen(true)}
          accessibilityLabel={isFiltered(filters) ? 'Filters, active' : 'Filters'}
          style={styles.filterButton}
          testID="open-filters"
        >
          <Icon name="filter" size={22} color={colors.orange} />
          {isFiltered(filters) ? <View style={styles.filterDot} /> : null}
        </PressableScale>
      </View>

      <View style={styles.chips}>
        <PillGroup
          options={SPORTS}
          value={filters.sport}
          onChange={(sport) =>
            setFilters((current) => ({
              ...current,
              sport: current.sport === sport ? null : (sport as Sport),
            }))
          }
          testID="search-sport"
        />
      </View>

      {results.isPending ? (
        <ActivityIndicator style={styles.loader} color={colors.orange} />
      ) : (
        <FlatList
          data={results.data ?? []}
          keyExtractor={(venue) => venue.id}
          renderItem={({ item }) => renderVenue(item)}
          ItemSeparatorComponent={() => <View style={styles.gap} />}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <EmptyState
              icon="search"
              title="Nothing matched"
              body={
                query
                  ? `No ground in Lahore matches “${query}”. Try an area like Johar Town, or clear the filters.`
                  : 'No ground matches these filters. Widen the price or pick another sport.'
              }
              actionLabel={isFiltered(filters) || query ? 'Clear search' : undefined}
              onAction={
                isFiltered(filters) || query
                  ? () => {
                      setQuery('');
                      setFilters(EMPTY_FILTERS);
                    }
                  : undefined
              }
            />
          }
        />
      )}

      <FilterSheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        value={filters}
        distribution={distribution}
        onApply={(next) => {
          setFilters(next);
          setSheetOpen(false);
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.gutter,
    paddingTop: spacing.md,
  },
  searchField: { flex: 1 },
  filterButton: {
    width: s(54),
    height: s(54),
    borderRadius: radius.search,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterDot: {
    position: 'absolute',
    top: s(10),
    right: s(10),
    width: s(8),
    height: s(8),
    borderRadius: s(4),
    backgroundColor: colors.orange,
  },
  chips: { paddingHorizontal: spacing.gutter, paddingTop: spacing.lg },
  list: { paddingHorizontal: spacing.gutter, paddingTop: spacing.lg, paddingBottom: spacing.xxl },
  gap: { height: s(14) },
  loader: { marginTop: s(48) },
});
