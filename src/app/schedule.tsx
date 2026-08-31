/**
 * Schedule — frame `27_Calendar`.
 *
 * Measured from the flattened export: a 40pt peach date chip at the gutter with the day's
 * heading beside it at y120, then that day's cards indented to x67 so they sit clear of
 * the chip, with the next day's chip 106 below.
 *
 * This is the agenda the frame draws, not a month grid. It answers "what am I playing and
 * when", which My Bookings — a flat upcoming/past list — does not: a booking and a match
 * you joined are different records but the same evening to the player, so both land here.
 */
import { useRouter, type Href } from 'expo-router';
import { useMemo } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';

import { AppBar, EmptyState, ListCard, Screen, Text } from '@/components/ui';
import { useBookings, useMyMatches, useVenues } from '@/data/queries';
import { FORMAT_LABELS, SPORT_LABELS } from '@/domain/labels';
import { chipParts, groupByDay, headingFor } from '@/lib/agenda';
import { formatClock } from '@/lib/datetime';
import { formatPkr } from '@/lib/money';
import { useGoBack } from '@/lib/navigation';
import { colors, radius, s, spacing } from '@/theme';

type Entry = {
  id: string;
  startAt: string;
  kind: 'booking' | 'match';
  title: string;
  metaLeft: string;
  metaRight?: string;
  photoUri?: string | null;
  /** The photo is always the ground's, even when the row is titled after the match. */
  photoName?: string;
  href: Href;
};

export default function ScheduleScreen() {
  const router = useRouter();
  const goBack = useGoBack('/(tabs)/profile');

  const bookings = useBookings();
  const matches = useMyMatches();
  const venues = useVenues();

  const venueById = useMemo(
    () => new Map((venues.data ?? []).map((venue) => [venue.id, venue])),
    [venues.data],
  );

  const days = useMemo(() => {
    const entries: Entry[] = [];

    for (const booking of bookings.data ?? []) {
      if (booking.status === 'cancelled') continue;
      const venue = venueById.get(booking.venueId);
      entries.push({
        id: booking.id,
        startAt: booking.startAt,
        kind: 'booking',
        title: venue?.name ?? 'Booking',
        // The frame's agenda card has no right column, so what would have sat there rides
        // on the meta line instead — which is why the title gets the full width.
        metaLeft:
          booking.dueAtVenue > 0
            ? `${formatClock(booking.startAt)} · ${formatPkr(booking.dueAtVenue)} due`
            : `${formatClock(booking.startAt)} · Paid`,
        metaRight: venue?.area,
        photoUri: venue?.photos[0],
        photoName: venue?.name,
        href: `/booking/${booking.id}`,
      });
    }

    for (const match of matches.data ?? []) {
      const venue = venueById.get(match.venueId);
      entries.push({
        id: match.id,
        startAt: match.startAt,
        kind: 'match',
        title: FORMAT_LABELS[match.format],
        metaLeft: `${formatClock(match.startAt)} · ${SPORT_LABELS[match.sport]} · ${formatPkr(
          match.pricePerPlayer,
        )}`,
        metaRight: venue?.area,
        photoUri: venue?.photos[0],
        photoName: venue?.name,
        href: '/(tabs)/matches',
      });
    }

    return groupByDay(entries);
  }, [bookings.data, matches.data, venueById]);

  const loading = bookings.isPending || matches.isPending || venues.isPending;

  return (
    <Screen>
      <AppBar title="Schedule" onBack={goBack} />

      {loading ? (
        <ActivityIndicator style={styles.loader} color={colors.orange} />
      ) : days.length === 0 ? (
        <EmptyState
          art={require('@/assets/images/empty/no-bookings.png')}
          title="Nothing booked yet"
          body="Your bookings and the matches you join will line up here, day by day."
          actionLabel="Find a ground"
          onAction={() => router.push('/grounds')}
          testID="schedule-empty"
        />
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {days.map((group) => {
            const chip = chipParts(group.day);
            return (
              <View key={group.day} style={styles.day}>
                <View style={styles.dayHead}>
                  <View style={styles.chip}>
                    <Text variant="meta" color={colors.orangeDeep}>
                      {chip.month}
                    </Text>
                    <Text variant="cardTitle" color={colors.orangeDeep} style={styles.chipDay}>
                      {chip.day}
                    </Text>
                  </View>
                  <Text
                    variant="metaStrong"
                    color={colors.textSecondary}
                    uppercase
                    numberOfLines={1}
                    style={styles.heading}
                  >
                    {headingFor(group.day)}
                  </Text>
                </View>

                <View style={styles.entries}>
                  {group.entries.map((entry) => (
                    <ListCard
                      key={`${entry.kind}-${entry.id}`}
                      id={entry.id}
                      title={entry.title}
                      metaLeft={entry.metaLeft}
                      metaRight={entry.metaRight}
                      photoUri={entry.photoUri}
                      photoName={entry.photoName}
                      onPress={() => router.push(entry.href)}
                      testID={`schedule-${entry.kind}-${entry.id}`}
                    />
                  ))}
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  loader: { marginTop: s(48) },
  scroll: { paddingHorizontal: spacing.gutter, paddingBottom: spacing.xxl },
  // Frame: 106 between one day's chip and the next.
  day: { marginTop: s(29) },
  dayHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  // Frame: a 40pt peach chip at the gutter.
  chip: {
    width: s(40),
    height: s(40),
    borderRadius: radius.chip,
    backgroundColor: colors.orangeWash,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipDay: { marginTop: s(1) },
  heading: { flex: 1 },
  // Frame: the day's cards are indented clear of the chip.
  entries: { marginTop: spacing.md, marginLeft: s(43), gap: s(14) },
});
