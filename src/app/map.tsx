/**
 * Map — frames `21_Location` / `22_Map View` / `23_Map View v2`.
 *
 * Measured from the flattened exports: a floating search bar at y50 with a locate button
 * beside it at x316, a row of white category pills at y100, pins drawn as 34pt rounded
 * squares with a pointer tail, a filter button bottom-right, and a horizontal card
 * carousel pinned to the bottom edge at y705.
 *
 * The map itself is OpenStreetMap through Leaflet in a WebView — Google Maps Platform
 * needs a key and billing (docs/05 §2), and OSM's coverage of the Lahore areas the seed
 * uses is good. Selecting a pin scrolls the carousel, and scrolling the carousel
 * highlights the pin, so the two halves of the screen always agree.
 */
import { useRouter } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, View, useWindowDimensions } from 'react-native';
import { WebView } from 'react-native-webview';

import { Icon } from '@/components/icons';
import { EmptyState, ListCard, PillGroup, PressableScale, Screen, Text } from '@/components/ui';
import { useVenues } from '@/data/queries';
import { buildMapHtml, type MapMarker } from '@/features/map/leaflet-html';
import { SPORT_LABELS } from '@/domain/labels';
import type { Sport, Venue } from '@/domain/types';
import { formatPkr } from '@/lib/money';
import { useGoBack } from '@/lib/navigation';
import { colors, radius, s, shadow, size, spacing } from '@/theme';

/** Centre of the launch city. docs/06 §2 starts in Lahore. */
const LAHORE = { latitude: 31.5204, longitude: 74.3587 };

const SPORTS = (['padel', 'futsal', 'cricket'] as const).map((sport) => ({
  value: sport,
  label: SPORT_LABELS[sport],
}));

export default function MapScreen() {
  const router = useRouter();
  const goBack = useGoBack('/grounds');
  const { width } = useWindowDimensions();

  const [sport, setSport] = useState<Sport | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mapFailed, setMapFailed] = useState(false);

  const venues = useVenues(sport ? { sport } : undefined);
  const carousel = useRef<FlatList<Venue>>(null);

  const markers = useMemo<MapMarker[]>(
    () =>
      (venues.data ?? []).map((venue) => ({
        id: venue.id,
        latitude: venue.geo.latitude,
        longitude: venue.geo.longitude,
        label: venue.name,
        selected: venue.id === selectedId,
      })),
    [venues.data, selectedId],
  );

  /**
   * Rebuilding the document on every selection would reload the tiles, so the html is
   * keyed on the marker set and the filter only — not on which pin is active. The
   * selected pin is redrawn by re-running the script, which Leaflet handles cheaply.
   */
  const html = useMemo(
    () =>
      buildMapHtml({
        markers,
        center: LAHORE,
        accentColor: colors.orange,
        inkColor: colors.ink,
      }),
    [markers],
  );

  const onMessage = (raw: string) => {
    try {
      const message = JSON.parse(raw) as { type: string; id?: string; reason?: string };
      if (message.type === 'error') {
        setMapFailed(true);
        return;
      }
      if (message.type === 'background') {
        setSelectedId(null);
        return;
      }
      if (message.type === 'marker' && message.id) {
        setSelectedId(message.id);
        const index = (venues.data ?? []).findIndex((venue) => venue.id === message.id);
        if (index >= 0) carousel.current?.scrollToIndex({ index, animated: true });
      }
    } catch {
      // A malformed message from the page is not worth surfacing to the player.
    }
  };

  const cardWidth = width - spacing.gutter * 2;

  return (
    <Screen edgeToEdge background={colors.background}>
      {mapFailed ? (
        <EmptyState
          icon="location"
          title="Map could not load"
          body="Check your connection and try again. You can still browse every ground as a list."
          actionLabel="Browse the list"
          onAction={() => router.replace('/grounds')}
          testID="map-failed"
        />
      ) : (
        <WebView
          originWhitelist={['*']}
          source={{ html }}
          style={styles.map}
          onMessage={(event) => onMessage(event.nativeEvent.data)}
          onError={() => setMapFailed(true)}
          onHttpError={() => setMapFailed(true)}
          startInLoadingState
          renderLoading={() => (
            <View style={styles.mapLoading}>
              <ActivityIndicator color={colors.orange} />
            </View>
          )}
          // The page is ours and fully inlined; nothing here should navigate away.
          setSupportMultipleWindows={false}
          javaScriptEnabled
          domStorageEnabled={false}
        />
      )}

      <View style={styles.topBar}>
        <View style={styles.searchBar}>
          <PressableScale onPress={goBack} accessibilityLabel="Go back">
            <Icon name="arrow-left" size={s(20)} color={colors.ink} />
          </PressableScale>
          <View style={styles.searchRule} />
          <PressableScale
            onPress={() => router.push('/search')}
            accessibilityLabel="Search grounds or areas"
            style={styles.searchTap}
            testID="map-search"
          >
            <Text variant="bodySmall" color={colors.textSecondary}>
              Find a ground or area
            </Text>
          </PressableScale>
          <Icon name="search" size={s(20)} color={colors.orange} />
        </View>

        <PressableScale
          onPress={() => router.push('/grounds')}
          accessibilityLabel="Switch to the list"
          style={styles.roundButton}
          testID="map-to-list"
        >
          <Icon name="filter" size={s(20)} color={colors.orange} />
        </PressableScale>
      </View>

      <View style={styles.chips}>
        <PillGroup
          options={SPORTS}
          value={sport}
          variant="floating"
          onChange={(next) => {
            setSelectedId(null);
            setSport((current) => (current === next ? null : next));
          }}
          testID="map-sport"
        />
      </View>

      {venues.isPending ? null : (venues.data ?? []).length === 0 ? (
        <View style={styles.noResults}>
          <Text variant="bodySmall" color={colors.textSecondary} align="center">
            No grounds for that sport in Lahore yet.
          </Text>
        </View>
      ) : (
        <FlatList
          ref={carousel}
          data={venues.data ?? []}
          keyExtractor={(venue) => venue.id}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          style={styles.carousel}
          contentContainerStyle={styles.carouselContent}
          // Every card is the same width, so the offset is computable — which is what
          // makes `scrollToIndex` from a pin tap safe.
          getItemLayout={(_, index) => ({
            length: cardWidth + spacing.md,
            offset: (cardWidth + spacing.md) * index,
            index,
          })}
          onMomentumScrollEnd={(event) => {
            const index = Math.round(event.nativeEvent.contentOffset.x / (cardWidth + spacing.md));
            setSelectedId((venues.data ?? [])[index]?.id ?? null);
          }}
          ItemSeparatorComponent={() => <View style={styles.carouselGap} />}
          renderItem={({ item }) => (
            <View style={{ width: cardWidth }}>
              <ListCard
                id={item.id}
                title={item.name}
                metaLeft={item.sports.map((each) => SPORT_LABELS[each]).join(' · ')}
                metaRight={item.area}
                photoUri={item.photos[0]}
                price={formatPkr(item.fromPricePerHour)}
                action="Book"
                onPress={() => router.push(`/venue/${item.id}`)}
                testID={`map-card-${item.id}`}
              />
            </View>
          )}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  map: { flex: 1 },
  mapLoading: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },

  // Frame: the search bar floats at y50 with the round button beside it at x316.
  topBar: {
    position: 'absolute',
    top: s(56),
    left: spacing.gutter,
    right: spacing.gutter,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    height: s(52),
    borderRadius: radius.search,
    backgroundColor: colors.card,
    paddingHorizontal: spacing.lg,
    ...shadow.card,
  },
  searchRule: { width: StyleSheet.hairlineWidth, height: s(22), backgroundColor: colors.border },
  searchTap: { flex: 1 },
  roundButton: {
    width: s(52),
    height: s(52),
    borderRadius: radius.search,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.card,
  },

  // Frame: a row of white pills at y100.
  chips: { position: 'absolute', top: s(120), left: spacing.gutter, right: spacing.gutter },

  carousel: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: s(28),
    flexGrow: 0,
  },
  carouselContent: { paddingHorizontal: spacing.gutter },
  carouselGap: { width: spacing.md },
  noResults: {
    position: 'absolute',
    left: spacing.gutter,
    right: spacing.gutter,
    bottom: s(28),
    padding: spacing.xl,
    borderRadius: radius.card,
    backgroundColor: colors.card,
    ...shadow.card,
    minHeight: size.listCardHeight,
    justifyContent: 'center',
  },
});
