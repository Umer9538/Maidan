/**
 * Venue preview — frame `13_Event Preview`.
 *
 * Measured from the flattened export: a full-bleed photo with no chrome except two
 * translucent circles at y36 (back at x24, favourite at x326), a two-line 24/600 title
 * whose lines sit at y513 and y561, an orange-iconed meta line at y659, and a full-width
 * orange CTA at y730 (327 x 57).
 *
 * The CTA's label is ink, not white. This is the one screen where the button is a solid
 * brand-orange fill, and white on #F76B10 is 2.97:1 — the contrast rule that governs the
 * selected slot chip governs this too.
 */
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, View, useWindowDimensions } from 'react-native';

import { Icon } from '@/components/icons';
import { Button, NotFound, PressableScale, Screen, Text } from '@/components/ui';
import { useVenue } from '@/data/queries';
import { useSaved } from '@/features/saved/context';
import { SPORT_LABELS } from '@/domain/labels';
import { formatOpeningHours } from '@/lib/datetime';
import { useGoBack } from '@/lib/navigation';
import { colors, s, size, spacing } from '@/theme';

export default function VenueGalleryScreen() {
  const { venueId } = useLocalSearchParams<{ venueId: string }>();
  const router = useRouter();
  const goBack = useGoBack('/grounds');
  const { width } = useWindowDimensions();
  const [index, setIndex] = useState(0);

  const venue = useVenue(venueId);
  const { isSaved, toggle } = useSaved();

  // Opened without an id — a stale link or a malformed deep link. The query behind this
  // screen is disabled without one, and a disabled query stays pending forever, so the
  // spinner below would never clear.
  if (!venueId) return <NotFound title="Photos" record="ground" onBack={goBack} />;

  if (venue.isPending || !venue.data) {
    return (
      <Screen edgeToEdge background={colors.ink} statusBarStyle="light">
        <ActivityIndicator style={styles.loader} color={colors.orange} />
      </Screen>
    );
  }

  const data = venue.data;
  const saved = isSaved(data.id);

  return (
    <Screen edgeToEdge background={colors.ink} statusBarStyle="light">
      <FlatList
        data={data.photos}
        keyExtractor={(uri, position) => `${uri}-${position}`}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(event) =>
          setIndex(Math.round(event.nativeEvent.contentOffset.x / width))
        }
        renderItem={({ item }) => (
          <Image
            source={{ uri: item }}
            style={[styles.photo, { width }]}
            contentFit="cover"
            transition={200}
            accessibilityIgnoresInvertColors
          />
        )}
      />

      {/* A scrim from mid-height down, so the title and CTA stay legible on any photo. */}
      <View style={styles.scrim} pointerEvents="none" />

      <View style={styles.controls}>
        <PressableScale onPress={goBack} accessibilityLabel="Go back" style={styles.circle}>
          <Icon name="arrow-left" size={s(16)} color={colors.white} />
        </PressableScale>
        <PressableScale
          onPress={() => toggle(data.id)}
          accessibilityLabel={saved ? 'Remove from saved' : 'Save this ground'}
          accessibilityState={{ selected: saved }}
          style={styles.circle}
        >
          <Icon
            name="heart"
            size={s(18)}
            color={saved ? colors.orange : colors.white}
            bold={saved}
          />
        </PressableScale>
      </View>

      {data.photos.length > 1 ? (
        <View
          style={styles.dots}
          accessibilityLabel={`Photo ${index + 1} of ${data.photos.length}`}
        >
          {data.photos.map((uri, position) => (
            <View key={uri} style={[styles.dot, position === index && styles.dotActive]} />
          ))}
        </View>
      ) : null}

      <View style={styles.footer}>
        <Text variant="screenTitle" color={colors.textOnDark} style={styles.title}>
          {data.name}
        </Text>

        <View style={styles.metaRow}>
          <Icon name="location" size={s(14)} color={colors.orange} bold />
          <Text variant="bodySmall" color={colors.surfaceMuted}>
            {data.area}
          </Text>
          <View style={styles.metaDot} />
          <Text
            variant="bodySmall"
            color={colors.surfaceMuted}
            numberOfLines={1}
            style={styles.metaFlex}
          >
            {data.sports.map((sport) => SPORT_LABELS[sport]).join(' · ')}
          </Text>
        </View>

        <Text variant="meta" color={colors.surfaceMuted} style={styles.hours}>
          {formatOpeningHours(data.hours.opensAt, data.hours.closesAt)}
        </Text>

        <Button
          label="Pick a slot"
          variant="accent"
          onPress={() => router.push({ pathname: '/booking/slots', params: { venueId: data.id } })}
          style={styles.cta}
          testID="gallery-pick-slot"
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  loader: { marginTop: s(80) },
  photo: { height: '100%' },
  scrim: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '40%',
    bottom: 0,
    backgroundColor: 'rgba(10, 11, 16, 0.62)',
  },
  controls: {
    position: 'absolute',
    top: s(56),
    left: spacing.gutter,
    right: spacing.gutter,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  circle: {
    width: size.actionCircle,
    height: size.actionCircle,
    borderRadius: size.actionCircle / 2,
    backgroundColor: colors.glassOnPhoto,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dots: {
    position: 'absolute',
    alignSelf: 'center',
    bottom: s(320),
    flexDirection: 'row',
    gap: s(6),
  },
  dot: {
    width: s(6),
    height: s(6),
    borderRadius: s(3),
    backgroundColor: colors.surfaceOnDark,
    opacity: 0.4,
  },
  dotActive: { opacity: 1, width: s(18) },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    // Frame: title at y513 of 812 — the block is anchored to the bottom so it holds on
    // taller screens rather than floating mid-photo.
    bottom: s(25),
    paddingHorizontal: spacing.gutter,
  },
  // Frame: 24/600 with the two lines 48 apart.
  title: { fontSize: s(24), lineHeight: s(34) },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: s(6), marginTop: s(18) },
  metaDot: {
    width: s(4),
    height: s(4),
    borderRadius: s(2),
    backgroundColor: colors.orange,
    marginHorizontal: s(2),
  },
  metaFlex: { flex: 1 },
  hours: { marginTop: s(6) },
  cta: { marginTop: s(24) },
});
