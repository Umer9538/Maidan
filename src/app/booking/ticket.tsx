/**
 * Ticket — the booking confirmation, built on the `45_Ticket` frame.
 *
 * An orange card wrapping the venue photo over a white stub carrying Date / Time / Court /
 * Paid, a perforated edge with circular side notches, and a code derived from the booking
 * id — stable per booking, never random, because this is what gets read out at the counter.
 * It becomes a QR in a real build.
 */
import { useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/icons';
import { AppBar, Button, NotFound, Photo, Screen, Text } from '@/components/ui';
import { useBooking, useCourts, useVenue } from '@/data/queries';
import { formatClock, formatSlotShort } from '@/lib/datetime';
import { formatPkr } from '@/lib/money';
import { useGoBack } from '@/lib/navigation';
import { colors, radius, s, size, spacing } from '@/theme';

const NOTCH = 22;

export default function TicketScreen() {
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
  const goBack = useGoBack('/bookings');

  const booking = useBooking(bookingId);
  const venue = useVenue(booking.data?.venueId ?? '');
  const courts = useCourts(booking.data?.venueId ?? '');

  // Opened without an id — a stale link or a malformed deep link. The query behind this
  // screen is disabled without one, and a disabled query stays pending forever, so the
  // spinner below would never clear.
  if (!bookingId) return <NotFound title="My ticket" record="booking" onBack={goBack} />;

  if (booking.isPending) {
    return (
      <Screen>
        <ActivityIndicator style={styles.loader} color={colors.orange} />
      </Screen>
    );
  }

  // A real id that resolves to nothing — a cancelled or deleted booking. Same dead end
  // as a missing id, so it gets the same screen and the same way out.
  if (!booking.data) return <NotFound title="My ticket" record="booking" onBack={goBack} />;

  const data = booking.data;
  const court = (courts.data ?? []).find((candidate) => candidate.id === data.courtId);

  return (
    <Screen>
      <AppBar title="My ticket" onBack={goBack} />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.confirmed}>
          <Icon name="check-circle" size={40} color={colors.orange} bold />
          <Text variant="cardTitle" align="center">
            Slot confirmed
          </Text>
          <Text variant="meta" color={colors.textSecondary} align="center">
            Show this code at the counter
          </Text>
        </View>

        <View style={styles.ticket}>
          <Photo
            uri={venue.data?.photos[0]}
            name={venue.data?.name ?? ''}
            id={data.venueId}
            style={styles.photo}
            monogramSize={s(48)}
          />

          <View style={styles.perforation}>
            <View style={[styles.notch, styles.notchLeft]} />
            <View style={styles.dashes} />
            <View style={[styles.notch, styles.notchRight]} />
          </View>

          <View style={styles.stub}>
            <Text variant="cardTitle">{venue.data?.name ?? ''}</Text>
            <Text variant="meta" color={colors.textSecondary}>
              {venue.data?.area ?? ''}
            </Text>

            <View style={styles.grid}>
              <Cell label="Date" value={formatSlotShort(data.startAt).split(',')[0]} />
              <Cell label="Time" value={formatClock(data.startAt)} />
              <Cell label="Court" value={court?.name ?? '—'} />
              <Cell label="Paid online" value={formatPkr(data.paidOnline)} />
            </View>

            {data.dueAtVenue > 0 ? (
              <View style={styles.due}>
                <Icon name="clock" size={14} color={colors.orange} bold />
                <Text variant="meta" color={colors.orangeDeep}>
                  {formatPkr(data.dueAtVenue)} due in cash at the counter
                </Text>
              </View>
            ) : null}

            <View style={styles.code}>
              <Text variant="meta" color={colors.textSecondary}>
                Booking code
              </Text>
              <Text variant="screenTitle" style={styles.codeValue}>
                {data.code}
              </Text>
            </View>
          </View>
        </View>

        <Button label="Done" variant="secondary" onPress={goBack} style={styles.done} />
      </ScrollView>
    </Screen>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.cell}>
      <Text variant="meta" color={colors.textSecondary}>
        {label}
      </Text>
      <Text variant="bodySmall" numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: spacing.gutter, paddingBottom: spacing.xxl, gap: spacing.gutter },
  loader: { marginTop: 64 },
  confirmed: { alignItems: 'center', gap: spacing.sm, paddingTop: spacing.lg },

  ticket: {
    backgroundColor: colors.orange,
    borderRadius: radius.sheet,
    overflow: 'hidden',
  },
  photo: { width: '100%', height: 180 },

  perforation: {
    height: NOTCH,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.orange,
  },
  notch: {
    width: NOTCH,
    height: NOTCH,
    borderRadius: NOTCH / 2,
    backgroundColor: colors.background,
  },
  notchLeft: { marginLeft: -NOTCH / 2 },
  notchRight: { marginRight: -NOTCH / 2 },
  dashes: {
    flex: 1,
    height: 1,
    marginHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.surfaceOnDark,
    opacity: 0.6,
  },

  stub: {
    backgroundColor: colors.card,
    padding: spacing.xl,
    gap: 4,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: spacing.lg },
  cell: { width: '50%', paddingVertical: spacing.sm, gap: 3 },
  due: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.sm },
  code: {
    marginTop: spacing.lg,
    paddingTop: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    alignItems: 'center',
    gap: 4,
  },
  codeValue: { letterSpacing: 6 },
  done: { alignSelf: 'stretch', height: size.ctaHeight },
});
