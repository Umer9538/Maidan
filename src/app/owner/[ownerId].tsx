/**
 * Venue owner profile — frames `50/51/52_Organizer Profile`.
 *
 * Measured from the flattened exports: a 96pt avatar at y128, the name at y247, a 35pt
 * three-up stat row at y301, a full-width 44pt action at y383, a tab row at y462 with a
 * 3pt indicator under the active label at y489, and content from y519.
 *
 * The frame's three tabs are About / Event / Review. Ours are About / Grounds / Reviews —
 * an owner's inventory is grounds, and the reviews are the verified ones players leave
 * after a completed booking (docs/04, Pillar 1).
 */
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/icons';
import {
  AppBar,
  Button,
  Divider,
  EmptyState,
  ListCard,
  PressableScale,
  Screen,
  Text,
  Thumb,
} from '@/components/ui';
import { usePlayer, useReviews, useVenues } from '@/data/queries';
import { AMENITY_LABELS, SPORT_LABELS } from '@/domain/labels';
import type { Review, Venue } from '@/domain/types';
import { formatRelative } from '@/lib/datetime';
import { formatPkr } from '@/lib/money';
import { useGoBack } from '@/lib/navigation';
import { colors, radius, s, spacing } from '@/theme';

type Tab = 'about' | 'grounds' | 'reviews';

const TABS: { value: Tab; label: string }[] = [
  { value: 'about', label: 'About' },
  { value: 'grounds', label: 'Grounds' },
  { value: 'reviews', label: 'Reviews' },
];

export default function OwnerProfileScreen() {
  const { ownerId } = useLocalSearchParams<{ ownerId: string }>();
  const router = useRouter();
  const goBack = useGoBack('/grounds');
  const [tab, setTab] = useState<Tab>('about');

  const owner = usePlayer(ownerId);
  const allVenues = useVenues();

  const venues = useMemo(
    () => (allVenues.data ?? []).filter((venue) => venue.ownerId === ownerId),
    [allVenues.data, ownerId],
  );

  // One owner, several grounds: the reviews tab reads the first, which is the only one
  // the mock API can join on today. A real endpoint would take the owner id directly.
  const reviews = useReviews(venues[0]?.id ?? '');

  const rating = useMemo(() => {
    const rated = venues.filter((venue) => venue.rating !== null);
    if (rated.length === 0) return null;
    return rated.reduce((sum, venue) => sum + (venue.rating ?? 0), 0) / rated.length;
  }, [venues]);

  const totalReviews = venues.reduce((sum, venue) => sum + venue.reviewCount, 0);

  if (allVenues.isPending) {
    return (
      <Screen>
        <ActivityIndicator style={styles.loader} color={colors.orange} />
      </Screen>
    );
  }

  return (
    <Screen>
      <AppBar title="Venue owner" onBack={goBack} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <View style={styles.identity}>
          <Thumb
            id={ownerId}
            name={owner.data?.name ?? 'Venue owner'}
            uri={owner.data?.avatarUrl}
            dimension={s(96)}
            circular
          />
          <Text variant="screenTitle" align="center" style={styles.name}>
            {owner.data?.name ?? 'Venue owner'}
          </Text>
          <View style={styles.verified}>
            <Icon name="shield" size={s(14)} color={colors.orange} bold />
            <Text variant="meta" color={colors.textSecondary}>
              Verified by Maidan
            </Text>
          </View>
        </View>

        <View style={styles.stats}>
          <Stat label={venues.length === 1 ? 'Ground' : 'Grounds'} value={String(venues.length)} />
          <View style={styles.statRule} />
          <Stat label="Rating" value={rating === null ? '—' : rating.toFixed(1)} />
          <View style={styles.statRule} />
          <Stat label="Reviews" value={String(totalReviews)} />
        </View>

        <Button
          label="Message owner"
          variant="secondary"
          style={styles.action}
          onPress={() => router.push(`/chat/thread-venue-${venues[0]?.id ?? ''}`)}
          testID="message-owner"
        />

        <View style={styles.tabs} accessibilityRole="tablist">
          {TABS.map((entry) => {
            const active = entry.value === tab;
            return (
              <PressableScale
                key={entry.value}
                onPress={() => setTab(entry.value)}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                accessibilityLabel={entry.label}
                style={styles.tab}
                testID={`owner-tab-${entry.value}`}
              >
                <Text
                  variant="cardTitle"
                  align="center"
                  color={active ? colors.orangeInk : colors.textSecondary}
                >
                  {entry.label}
                </Text>
                {/* Frame: a 3pt indicator sits under the active label. */}
                <View style={[styles.indicator, active && styles.indicatorActive]} />
              </PressableScale>
            );
          })}
        </View>

        <View style={styles.content}>
          {tab === 'about' ? <About venues={venues} /> : null}
          {tab === 'grounds' ? (
            <Grounds venues={venues} onOpen={(id) => router.push(`/venue/${id}`)} />
          ) : null}
          {tab === 'reviews' ? (
            <Reviews reviews={reviews.data ?? []} loading={reviews.isPending} />
          ) : null}
        </View>
      </ScrollView>
    </Screen>
  );
}

function About({ venues }: { venues: Venue[] }) {
  const areas = Array.from(new Set(venues.map((venue) => venue.area)));
  const sports = Array.from(new Set(venues.flatMap((venue) => venue.sports)));
  const amenities = Array.from(new Set(venues.flatMap((venue) => venue.amenities)));

  return (
    <>
      <Text variant="cardTitle" style={styles.sectionTitle}>
        About
      </Text>
      <Text variant="bodySmall" color={colors.textSecondary}>
        {venues[0]?.about ?? 'This owner has not added a description yet.'}
      </Text>

      <Text variant="cardTitle" style={styles.sectionTitle}>
        Sports
      </Text>
      <View style={styles.chips}>
        {sports.map((sport) => (
          <View key={sport} style={styles.chip}>
            <Text variant="meta" color={colors.orangeDeep}>
              {SPORT_LABELS[sport]}
            </Text>
          </View>
        ))}
      </View>

      <Text variant="cardTitle" style={styles.sectionTitle}>
        Areas
      </Text>
      <Text variant="bodySmall" color={colors.textSecondary}>
        {areas.join(' · ')}
      </Text>

      <Text variant="cardTitle" style={styles.sectionTitle}>
        Facilities
      </Text>
      <View style={styles.chips}>
        {amenities.map((amenity) => (
          <View key={amenity} style={styles.chip}>
            <Text variant="meta" color={colors.orangeDeep}>
              {AMENITY_LABELS[amenity]}
            </Text>
          </View>
        ))}
      </View>
    </>
  );
}

function Grounds({ venues, onOpen }: { venues: Venue[]; onOpen: (venueId: string) => void }) {
  if (venues.length === 0) {
    return (
      <EmptyState
        icon="location"
        title="No grounds listed"
        body="This owner has not listed a ground yet."
      />
    );
  }

  return (
    <View style={styles.groundList}>
      {venues.map((venue) => (
        <ListCard
          key={venue.id}
          id={venue.id}
          title={venue.name}
          metaLeft={venue.sports.map((sport) => SPORT_LABELS[sport]).join(' · ')}
          metaRight={venue.area}
          photoUri={venue.photos[0]}
          price={formatPkr(venue.fromPricePerHour)}
          action="Book"
          onPress={() => onOpen(venue.id)}
          testID={`owner-ground-${venue.id}`}
        />
      ))}
    </View>
  );
}

function Reviews({ reviews, loading }: { reviews: Review[]; loading: boolean }) {
  if (loading) return <ActivityIndicator style={styles.loader} color={colors.orange} />;

  if (reviews.length === 0) {
    return (
      <EmptyState
        icon="chat"
        title="No reviews yet"
        body="Reviews appear once players have finished a booking here."
      />
    );
  }

  return (
    <>
      {reviews.map((review, index) => (
        <View key={review.id}>
          <View style={styles.review}>
            <Thumb
              id={review.authorId}
              name={review.authorName}
              uri={review.authorAvatarUrl}
              dimension={s(40)}
              circular
            />
            <View style={styles.reviewBody}>
              <View style={styles.reviewHead}>
                <Text variant="rowTitle" style={styles.reviewName}>
                  {review.authorName}
                </Text>
                <Text variant="meta" color={colors.textSecondary}>
                  {formatRelative(review.createdAt)}
                </Text>
              </View>
              <View
                style={styles.starRow}
                accessible
                accessibilityLabel={`${review.rating} out of 5 stars`}
              >
                {Array.from({ length: 5 }, (_, star) => (
                  <Icon
                    key={star}
                    name="star"
                    size={s(12)}
                    color={star < review.rating ? colors.orange : colors.border}
                    bold={star < review.rating}
                  />
                ))}
              </View>
              <Text variant="bodySmall" color={colors.textSecondary}>
                {review.body}
              </Text>
            </View>
          </View>
          {index < reviews.length - 1 ? <Divider /> : null}
        </View>
      ))}
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat} accessible accessibilityLabel={`${value} ${label}`}>
      <Text variant="screenTitle">{value}</Text>
      <Text variant="meta" color={colors.textSecondary}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  loader: { marginTop: s(48) },
  scroll: { paddingHorizontal: spacing.gutter, paddingBottom: spacing.xxl },
  identity: { alignItems: 'center', paddingTop: s(37), gap: s(10) },
  name: { marginTop: s(13) },
  verified: { flexDirection: 'row', alignItems: 'center', gap: s(6) },

  // Frame: a 35pt stat row at y301.
  stats: { flexDirection: 'row', alignItems: 'center', marginTop: s(39) },
  stat: { flex: 1, alignItems: 'center', gap: s(4) },
  statRule: { width: StyleSheet.hairlineWidth, height: s(36), backgroundColor: colors.border },

  // Frame: a 44pt action at y383.
  action: { marginTop: s(47), height: s(44) },

  tabs: { flexDirection: 'row', marginTop: s(35) },
  tab: { flex: 1, gap: s(4) },
  indicator: { height: s(3), borderRadius: s(2), backgroundColor: 'transparent' },
  indicatorActive: { backgroundColor: colors.orange },

  content: { marginTop: s(27) },
  sectionTitle: { marginTop: spacing.xl, marginBottom: spacing.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    paddingHorizontal: s(12),
    paddingVertical: s(7),
    borderRadius: radius.pill,
    backgroundColor: colors.orangeWash,
  },
  groundList: { gap: s(14) },

  review: { flexDirection: 'row', gap: spacing.md, paddingVertical: spacing.lg },
  reviewBody: { flex: 1, gap: s(6) },
  reviewHead: { flexDirection: 'row', alignItems: 'center' },
  reviewName: { flex: 1 },
  starRow: { flexDirection: 'row', gap: s(3) },
});
