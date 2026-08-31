/**
 * Home — frame `12_Home`.
 *
 * The frame is flattened, so the structure came out of the pixels: a dark hero to y260
 * (avatar, greeting and city on one row, then the search field with a 52pt filter button),
 * a section head with VIEW ALL, a horizontal rail of 250pt media cards with the next one
 * peeking, a "Choose By Category" head at y533, a 42pt category row at y573, then compact
 * 327x78 list cards from y643.
 *
 * The frame's categories are Design / Art / Sports / Music and its city is Dhaka. Ours are
 * the three sports and Lahore.
 */
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { ActivityIndicator, FlatList, ScrollView, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/icons';
import {
  EmptyState,
  ListCard,
  MEDIA_CARD_RAIL_GAP,
  MediaCard,
  PillGroup,
  PressableScale,
  Screen,
  SearchBar,
  Text,
  Thumb,
} from '@/components/ui';
import { useCurrentPlayer, useNotifications, useVenues } from '@/data/queries';
import { useSaved } from '@/features/saved/context';
import { SPORT_LABELS } from '@/domain/labels';
import type { Sport, Venue } from '@/domain/types';
import { formatOpeningHours } from '@/lib/datetime';
import { formatPkr } from '@/lib/money';
import { useConfirmExit } from '@/lib/navigation';
import { colors, radius, s, spacing } from '@/theme';

const SPORTS = (['padel', 'futsal', 'cricket'] as const).map((sport) => ({
  value: sport,
  label: SPORT_LABELS[sport],
}));

export default function HomeScreen() {
  // Home is the bottom of the stack, so Android's back button closes the app from here.
  // One press is too little ceremony for leaving, and it is the same button used to climb
  // back out of a booking — so the first press only warns.
  useConfirmExit();

  const router = useRouter();
  const player = useCurrentPlayer();
  const notifications = useNotifications();
  const venues = useVenues();
  const { isSaved, toggle } = useSaved();

  const unread = (notifications.data ?? []).some((notification) => !notification.read);

  /** The rail leads with the busiest grounds; the list below carries everything. */
  const popular = useMemo(
    () => [...(venues.data ?? [])].sort((a, b) => b.playerCount - a.playerCount).slice(0, 5),
    [venues.data],
  );

  const openVenue = (venueId: string) => router.push(`/venue/${venueId}`);

  const renderRailCard = (venue: Venue) => (
    <MediaCard
      title={venue.name}
      photoUri={venue.photos[0]}
      facts={[
        { icon: 'clock', label: formatOpeningHours(venue.hours.opensAt, venue.hours.closesAt) },
        { icon: 'location', label: venue.area },
      ]}
      avatarUris={venue.photos.slice(0, 3)}
      footerLabel={`${formatPkr(venue.fromPricePerHour)}/hr`}
      actionLabel="Book now"
      onPress={() => openVenue(venue.id)}
      onToggleSaved={() => toggle(venue.id)}
      saved={isSaved(venue.id)}
      testID={`rail-${venue.id}`}
    />
  );

  return (
    <Screen edgeToEdge statusBarStyle="light" background={colors.ink}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        stickyHeaderIndices={[]}
      >
        <View style={styles.hero}>
          <View style={styles.heroTop}>
            <Thumb
              id={player.data?.id ?? 'me'}
              name={player.data?.name ?? 'You'}
              uri={player.data?.avatarUrl}
              dimension={s(44)}
              circular
            />
            <View style={styles.greeting}>
              <Text variant="meta" color={colors.surfaceMuted}>
                Assalamualaikum
              </Text>
              <Text variant="cardTitle" color={colors.textOnDark} numberOfLines={1}>
                {player.data?.name ?? 'Welcome'}
              </Text>
            </View>
            <View style={styles.city}>
              <Text variant="meta" color={colors.surfaceMuted} align="right">
                Current city
              </Text>
              <View style={styles.cityRow}>
                <Icon name="location" size={s(12)} color={colors.orange} bold />
                <Text variant="metaStrong" color={colors.textOnDark}>
                  Lahore
                </Text>
              </View>
            </View>
            <PressableScale
              onPress={() => router.push('/notifications')}
              accessibilityLabel={unread ? 'Notifications, unread' : 'Notifications'}
            >
              <View>
                <Icon name="chat" size={s(22)} color={colors.surfaceOnDark} />
                {unread ? <View style={styles.unreadDot} /> : null}
              </View>
            </PressableScale>
          </View>

          <View style={styles.searchRow}>
            <View style={styles.searchField}>
              <PressableScale
                onPress={() => router.push('/search')}
                accessibilityLabel="Search grounds or areas"
                testID="home-search"
              >
                <View pointerEvents="none">
                  <SearchBar value="" onChangeText={() => {}} placeholder="Find a ground or area" />
                </View>
              </PressableScale>
            </View>
            <PressableScale
              onPress={() => router.push('/search')}
              accessibilityLabel="Filters"
              style={styles.filterButton}
              testID="home-filters"
            >
              <Icon name="filter" size={s(20)} color={colors.orange} />
            </PressableScale>
          </View>
        </View>

        <SectionHead
          title="Popular grounds"
          onViewAll={() => router.push('/grounds')}
          testID="popular-view-all"
        />

        {venues.isPending ? (
          <ActivityIndicator style={styles.loader} color={colors.orange} />
        ) : (
          <FlatList
            data={popular}
            keyExtractor={(venue) => venue.id}
            renderItem={({ item }) => renderRailCard(item)}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.rail}
            ItemSeparatorComponent={() => <View style={styles.railGap} />}
          />
        )}

        <SectionHead title="Choose by sport" />
        <View style={styles.categories}>
          <PillGroup
            options={SPORTS}
            value={null}
            onChange={(sport) =>
              router.push({ pathname: '/grounds', params: { sport: sport as Sport } })
            }
            testID="home-sports"
          />
        </View>

        <SectionHead title="All grounds" onViewAll={() => router.push('/grounds')} />
        <View style={styles.list}>
          {(venues.data ?? []).slice(0, 3).map((venue) => (
            <View key={venue.id} style={styles.listItem}>
              <ListCard
                id={venue.id}
                title={venue.name}
                metaLeft={venue.sports.map((sport) => SPORT_LABELS[sport]).join(' · ')}
                metaRight={venue.area}
                photoUri={venue.photos[0]}
                price={formatPkr(venue.fromPricePerHour)}
                action="Book"
                onPress={() => openVenue(venue.id)}
                testID={`venue-${venue.id}`}
              />
            </View>
          ))}

          {!venues.isPending && (venues.data ?? []).length === 0 ? (
            <EmptyState
              icon="location"
              title="No grounds yet"
              body="Nothing is live in Lahore right now. Check back shortly."
            />
          ) : null}
        </View>
      </ScrollView>
    </Screen>
  );
}

function SectionHead({
  title,
  onViewAll,
  testID,
}: {
  title: string;
  onViewAll?: () => void;
  testID?: string;
}) {
  return (
    <View style={styles.sectionHead}>
      <Text variant="cardTitle" style={styles.sectionTitle}>
        {title}
      </Text>
      {onViewAll ? (
        <PressableScale
          onPress={onViewAll}
          accessibilityLabel={`View all ${title}`}
          testID={testID}
        >
          <Text variant="metaStrong" color={colors.orangeInk} uppercase>
            View all
          </Text>
        </PressableScale>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { backgroundColor: colors.background, paddingBottom: spacing.xxl },
  hero: {
    backgroundColor: colors.ink,
    paddingHorizontal: spacing.gutter,
    // Clears the status bar; the frame's drawn bar is replaced by real insets.
    paddingTop: s(64),
    paddingBottom: spacing.gutter,
    borderBottomLeftRadius: radius.sheet,
    borderBottomRightRadius: radius.sheet,
    gap: spacing.xl,
  },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  greeting: { flex: 1, gap: s(2) },
  city: { gap: s(2) },
  cityRow: { flexDirection: 'row', alignItems: 'center', gap: s(4), justifyContent: 'flex-end' },
  unreadDot: {
    position: 'absolute',
    top: s(-2),
    right: s(-2),
    width: s(8),
    height: s(8),
    borderRadius: s(4),
    backgroundColor: colors.orange,
  },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  searchField: { flex: 1 },
  filterButton: {
    width: s(52),
    height: s(52),
    borderRadius: radius.search,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },

  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.gutter,
    marginTop: spacing.gutter,
    marginBottom: spacing.lg,
  },
  sectionTitle: { flex: 1 },

  rail: { paddingHorizontal: spacing.gutter },
  railGap: { width: MEDIA_CARD_RAIL_GAP },
  categories: { paddingHorizontal: spacing.gutter },
  list: { paddingHorizontal: spacing.gutter },
  listItem: { marginBottom: s(14) },
  loader: { marginVertical: s(48) },
});
