/**
 * Venue Details — a direct port of the `Venue Details` frame (node 1:353).
 *
 * Geometry from the node tree: a 375x395 hero under a 20% black scrim, a sheet with 20px
 * top corners overlapping it, and a bottom bar carrying the 50x50 bookmark beside the
 * 265x58 CTA.
 */
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/icons';
import {
  AvatarStack,
  Button,
  Divider,
  IconButton,
  Photo,
  PressableScale,
  PriceChip,
  Screen,
  Text,
  Thumb,
} from '@/components/ui';
import { useCourts, usePlayer, useReviews, useVenue } from '@/data/queries';
import { AMENITY_LABELS } from '@/domain/labels';
import { formatOpeningHours } from '@/lib/datetime';
import { formatPkrPerHour } from '@/lib/money';
import { useGoBack } from '@/lib/navigation';
import { colors, radius, s, size, spacing } from '@/theme';

export default function VenueDetailsScreen() {
  const { venueId } = useLocalSearchParams<{ venueId: string }>();
  const router = useRouter();
  const goBack = useGoBack('/grounds');
  const [saved, setSaved] = useState(false);

  const venue = useVenue(venueId);
  const courts = useCourts(venueId);
  const owner = usePlayer(venue.data?.ownerId);
  const reviews = useReviews(venueId);

  if (venue.isPending) {
    return (
      <Screen>
        <ActivityIndicator style={styles.loader} color={colors.orange} />
      </Screen>
    );
  }

  if (venue.isError || !venue.data) {
    return (
      <Screen>
        <View style={styles.errorWrap}>
          <Text variant="cardTitle" align="center">
            We could not load this venue
          </Text>
          <Button label="Try again" onPress={() => venue.refetch()} style={styles.retry} />
        </View>
      </Screen>
    );
  }

  const data = venue.data;
  const openHours = formatOpeningHours(data.hours.opensAt, data.hours.closesAt);

  return (
    <Screen edgeToEdge statusBarStyle="light" background={colors.ink}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        bounces={false}
      >
        <View style={styles.heroWrap}>
          <PressableScale
            onPress={() =>
              router.push({ pathname: '/venue/gallery', params: { venueId: data.id } })
            }
            accessibilityLabel={`View ${data.photos.length} photos of ${data.name}`}
            style={styles.heroPress}
          >
            <Photo
              uri={data.photos[0]}
              name={data.name}
              id={data.id}
              style={styles.hero}
              monogramSize={s(64)}
            />
          </PressableScale>
          <View style={styles.scrim} />

          <View style={styles.heroControls}>
            <PressableScale
              onPress={goBack}
              accessibilityLabel="Go back"
              style={styles.glassCircle}
            >
              <Icon name="arrow-left" size={16} color={colors.white} />
            </PressableScale>
            <PressableScale
              onPress={() => setSaved((current) => !current)}
              accessibilityLabel={saved ? 'Remove from favourites' : 'Add to favourites'}
              accessibilityState={{ selected: saved }}
              style={styles.glassCircle}
            >
              <Icon
                name="heart"
                size={18}
                color={saved ? colors.orange : colors.white}
                bold={saved}
              />
            </PressableScale>
          </View>
        </View>

        <View style={styles.sheet}>
          <View style={styles.handle} />

          <View style={styles.titleRow}>
            <View style={styles.titleCol}>
              <Text variant="cardTitle">{data.name}</Text>
              <View style={styles.factRow}>
                <View style={styles.fact}>
                  <Icon name="location" size={12} color={colors.orange} bold />
                  <Text variant="meta" color={colors.textSecondary}>
                    {data.area}
                  </Text>
                </View>
                <View style={styles.fact}>
                  <Icon name="clock" size={12} color={colors.orange} bold />
                  <Text variant="meta" color={colors.textSecondary}>
                    {openHours}
                  </Text>
                </View>
              </View>
            </View>
            <PriceChip label={`From ${formatPkrPerHour(data.fromPricePerHour)}`} />
          </View>

          <View style={styles.participants}>
            <Text variant="metaStrong" color={colors.textSecondary}>
              {data.playerCount >= 1000
                ? `${Math.round(data.playerCount / 100) / 10}k+`
                : `${data.playerCount}`}
            </Text>
            <Text variant="meta" color={colors.textSecondary} style={styles.participantsLabel}>
              players booked here
            </Text>
            <AvatarStack uris={data.photos.slice(0, 3)} overflowLabel="5k+" />
          </View>

          <Divider style={styles.divider} />

          <PressableScale
            onPress={() => router.push(`/owner/${data.ownerId}`)}
            accessibilityLabel={`${owner.data?.name ?? 'Venue owner'}, view profile`}
            style={styles.owner}
            testID="open-owner"
          >
            <Thumb
              id={data.ownerId}
              name={owner.data?.name ?? 'Venue owner'}
              uri={owner.data?.avatarUrl}
              dimension={size.actionCircle}
              circular
            />
            <View style={styles.ownerText}>
              <Text variant="bodySmall" style={styles.ownerName}>
                {owner.data?.name ?? 'Venue owner'}
              </Text>
              <Text variant="meta" color={colors.textSecondary}>
                Venue owner · Verified by Maidan
              </Text>
            </View>
            {/*
              The frame carries call and message buttons. Contacting a venue runs through
              the in-app thread once messaging is wired to a venue; a call button with no
              number behind it would announce an action that does not exist.
            */}
            <View style={styles.circleAction}>
              <Icon name="chevron-right" size={18} color={colors.orange} />
            </View>
          </PressableScale>

          <Text variant="cardTitle" style={styles.sectionTitle}>
            About Venue
          </Text>
          <Text variant="bodySmall" color={colors.textSecondary}>
            {data.about}
          </Text>

          <Text variant="cardTitle" style={styles.sectionTitle}>
            Amenities
          </Text>
          <View style={styles.amenities}>
            {data.amenities.map((amenity) => (
              <View key={amenity} style={styles.amenity}>
                <Icon name="tick" size={12} color={colors.orange} />
                <Text variant="meta" color={colors.textSecondary}>
                  {AMENITY_LABELS[amenity]}
                </Text>
              </View>
            ))}
          </View>

          {(reviews.data ?? []).length > 0 ? (
            <>
              <View style={styles.reviewsHead}>
                <Text variant="cardTitle">
                  {data.rating ? `${data.rating.toFixed(1)} · ` : ''}
                  {reviews.data?.length === 1 ? '1 review' : `${reviews.data?.length} reviews`}
                </Text>
                <View style={styles.starRow}>
                  {Array.from({ length: 5 }, (_, star) => (
                    <Icon
                      key={star}
                      name="star"
                      size={14}
                      color={star < Math.round(data.rating ?? 0) ? colors.orange : colors.border}
                      bold={star < Math.round(data.rating ?? 0)}
                    />
                  ))}
                </View>
              </View>
              {/* Two is enough to judge a ground by; the rest live on the owner's profile. */}
              {(reviews.data ?? []).slice(0, 2).map((review) => (
                <View key={review.id} style={styles.review}>
                  <Thumb
                    id={review.authorId}
                    name={review.authorName}
                    uri={review.authorAvatarUrl}
                    dimension={32}
                    circular
                  />
                  <View style={styles.reviewBody}>
                    <Text variant="meta" color={colors.textSecondary}>
                      {review.authorName}
                    </Text>
                    <Text variant="bodySmall" color={colors.textSecondary}>
                      {review.body}
                    </Text>
                  </View>
                </View>
              ))}
            </>
          ) : null}

          <Text variant="cardTitle" style={styles.sectionTitle}>
            {courts.data?.length === 1 ? '1 court' : `${courts.data?.length ?? 0} courts`}
          </Text>
          {(courts.data ?? []).map((court) => (
            <View key={court.id} style={styles.courtRow}>
              <View style={styles.courtText}>
                <Text variant="bodySmall">{court.name}</Text>
                <Text variant="meta" color={colors.textSecondary}>
                  {court.surface} · {court.indoor ? 'Indoor' : 'Outdoor'}
                </Text>
              </View>
              <Text variant="metaStrong" color={colors.orangeInk}>
                {formatPkrPerHour(court.basePricePerHour)}
              </Text>
            </View>
          ))}
        </View>
      </ScrollView>

      <View style={styles.bottomBar}>
        <IconButton
          name="bookmark"
          accessibilityLabel={saved ? 'Saved' : 'Save venue'}
          active={saved}
          onPress={() => setSaved((current) => !current)}
        />
        <Button
          label="Book a slot"
          style={styles.cta}
          onPress={() => router.push({ pathname: '/booking/slots', params: { venueId } })}
          testID="book-a-slot"
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: size.bottomBarHeight + spacing.xl },
  loader: { marginTop: 64 },
  errorWrap: { padding: spacing.gutter, gap: spacing.lg, marginTop: 64 },
  retry: { alignSelf: 'stretch' },

  heroWrap: { height: size.heroHeight },
  heroPress: { width: '100%', height: '100%' },
  hero: { width: '100%', height: '100%' },
  scrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.scrim,
  },
  heroControls: {
    position: 'absolute',
    top: 56,
    left: spacing.gutter,
    right: spacing.gutter,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  glassCircle: {
    width: size.actionCircle,
    height: size.actionCircle,
    borderRadius: size.actionCircle / 2,
    backgroundColor: colors.glassOnPhoto,
    alignItems: 'center',
    justifyContent: 'center',
  },

  sheet: {
    marginTop: -26,
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    paddingHorizontal: spacing.gutter,
    paddingTop: spacing.lg,
  },
  handle: {
    width: 42,
    height: 4,
    borderRadius: radius.handle,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: spacing.gutter,
  },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  titleCol: { flex: 1, gap: spacing.md },
  factRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg },
  fact: { flexDirection: 'row', alignItems: 'center', gap: 4 },

  participants: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.xl, gap: 6 },
  participantsLabel: { flex: 1 },
  divider: { marginVertical: spacing.xl },

  owner: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  ownerText: { flex: 1, gap: 2 },
  ownerName: { lineHeight: 16 },
  circleAction: {
    width: size.actionCircle,
    height: size.actionCircle,
    borderRadius: size.actionCircle / 2,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },

  sectionTitle: { marginTop: spacing.gutter, marginBottom: spacing.md },
  amenities: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  amenity: { flexDirection: 'row', alignItems: 'center', gap: 6, width: '46%' },

  courtRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  courtText: { flex: 1, gap: 3 },

  reviewsHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.gutter,
    marginBottom: spacing.md,
  },
  starRow: { flexDirection: 'row', gap: 3 },
  review: { flexDirection: 'row', gap: spacing.md, paddingVertical: spacing.sm },
  reviewBody: { flex: 1, gap: 3 },

  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: size.bottomBarHeight,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.gutter,
    paddingBottom: spacing.gutter,
    backgroundColor: colors.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  cta: { flex: 1 },
});
