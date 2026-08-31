/**
 * Venue dashboard — the owner surface. No Figma frame exists for it: docs/07 §5 names it
 * the largest design gap, and docs/06 §3 names it the highest-leverage thing to build,
 * because the supply-first launch signs venues onto free tooling before any player arrives.
 *
 * The screen is a day sheet, and the point of it is completeness. docs/06 §9 puts a stale
 * calendar at the top of the risk list: one venue whose walk-ins live in a notebook poisons
 * the whole marketplace, because a player books a court that was already gone. So the
 * empty rows are as important as the booked ones — tapping one records a counter booking
 * through the same slot check an app booking faces.
 */
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/icons';
import { AppBar, Divider, PressableScale, Screen, Segmented, Text } from '@/components/ui';
import { useCourts, useSlots, useVenue, useVenueBookings, useVenueEarnings } from '@/data/queries';
import { useAuth } from '@/features/auth/context';
import { chipParts, headingFor } from '@/lib/agenda';
import { formatClock } from '@/lib/datetime';
import { formatPkr } from '@/lib/money';
import type { Booking, Slot } from '@/domain/types';
import { useGoBack } from '@/lib/navigation';
import { colors, radius, s, shadow, spacing } from '@/theme';

const DAYS_SHOWN = 5;

export default function OwnerDashboardScreen() {
  const params = useLocalSearchParams<{ venueId?: string }>();
  const router = useRouter();
  const goBack = useGoBack('/(tabs)/profile');
  const { session } = useAuth();

  const venueId = params.venueId ?? session?.ownedVenueIds[0] ?? '';
  const [dayIndex, setDayIndex] = useState(0);
  const [courtId, setCourtId] = useState<string | null>(null);

  const days = useMemo(() => {
    const today = new Date();
    return Array.from({ length: DAYS_SHOWN }, (_, offset) => {
      const date = new Date(today);
      date.setDate(date.getDate() + offset);
      return date.toISOString();
    });
  }, []);
  const day = days[dayIndex];

  const venue = useVenue(venueId);
  const courts = useCourts(venueId);
  const activeCourtId = courtId ?? courts.data?.[0]?.id;
  const slots = useSlots(activeCourtId, day);
  const bookings = useVenueBookings(venueId, day);
  const earnings = useVenueEarnings(venueId, day);

  /** One row per slot, carrying whichever booking sits on it. */
  const rows = useMemo(() => {
    const byStart = new Map(
      (bookings.data ?? [])
        .filter((booking) => booking.courtId === activeCourtId)
        .map((booking) => [booking.startAt, booking]),
    );
    return (slots.data ?? []).map((slot) => ({ slot, booking: byStart.get(slot.startAt) ?? null }));
  }, [slots.data, bookings.data, activeCourtId]);

  if (!venueId) {
    return (
      <Screen>
        <AppBar title="Venue dashboard" onBack={goBack} />
        <View style={styles.notOwner}>
          <Text variant="cardTitle" align="center">
            No venue to manage
          </Text>
          <Text variant="bodySmall" color={colors.textSecondary} align="center">
            This account does not manage a ground yet.
          </Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <AppBar title={venue.data?.name ?? 'Venue dashboard'} onBack={goBack} actions={[]} />

      <View style={styles.dayStrip}>
        {days.map((each, index) => {
          const chip = chipParts(each);
          const active = index === dayIndex;
          return (
            <PressableScale
              key={each}
              onPress={() => setDayIndex(index)}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              accessibilityLabel={headingFor(each)}
              style={[styles.day, active && styles.dayActive]}
              testID={`owner-day-${index}`}
            >
              <Text variant="meta" color={active ? colors.textOnOrange : colors.textSecondary}>
                {chip.month}
              </Text>
              <Text
                variant="cardTitle"
                color={active ? colors.textOnOrange : colors.ink}
                style={styles.dayNumber}
              >
                {chip.day}
              </Text>
            </PressableScale>
          );
        })}
      </View>

      {(courts.data?.length ?? 0) > 1 ? (
        <View style={styles.courts}>
          <Segmented
            options={(courts.data ?? []).slice(0, 2).map((court) => ({
              value: court.id,
              label: court.name,
            }))}
            value={activeCourtId ?? ''}
            onChange={setCourtId}
            testID="owner-court"
          />
        </View>
      ) : null}

      <View style={styles.summary}>
        <Summary label="Booked" value={`${earnings.data?.bookingCount ?? 0}`} />
        <View style={styles.summaryRule} />
        <Summary label="Walk-ins" value={`${earnings.data?.manualCount ?? 0}`} />
        <View style={styles.summaryRule} />
        <Summary label="Day total" value={formatPkr(earnings.data?.dayTotal ?? 0)} />
      </View>

      {slots.isPending || bookings.isPending ? (
        <ActivityIndicator style={styles.loader} color={colors.orange} />
      ) : (
        <ScrollView contentContainerStyle={styles.sheet} showsVerticalScrollIndicator={false}>
          {rows.map(({ slot, booking }, index) => (
            <View key={slot.startAt}>
              <Row
                slot={slot}
                booking={booking}
                onAddWalkIn={() =>
                  router.push({
                    pathname: '/owner/walk-in',
                    params: {
                      venueId,
                      courtId: slot.courtId,
                      startAt: slot.startAt,
                      price: String(slot.price),
                    },
                  })
                }
              />
              {index < rows.length - 1 ? <Divider /> : null}
            </View>
          ))}
        </ScrollView>
      )}
    </Screen>
  );
}

function Row({
  slot,
  booking,
  onAddWalkIn,
}: {
  slot: Slot;
  booking: Booking | null;
  onAddWalkIn: () => void;
}) {
  const time = formatClock(slot.startAt);

  if (booking) {
    const walkIn = booking.source === 'manual';
    return (
      <View style={styles.row} accessible accessibilityLabel={`${time}, booked`}>
        <Text variant="metaStrong" color={colors.textSecondary} style={styles.time}>
          {time}
        </Text>
        <View style={styles.rowBody}>
          <Text variant="bodySmall" numberOfLines={1}>
            {walkIn ? (booking.customer?.name ?? 'Walk-in') : 'App booking'}
          </Text>
          <Text variant="meta" color={colors.textSecondary} numberOfLines={1}>
            {booking.code}
            {walkIn && booking.customer ? ` · ${booking.customer.phone}` : ''}
          </Text>
        </View>
        <View style={styles.amount}>
          <Text variant="metaStrong" color={colors.ink}>
            {formatPkr(booking.total)}
          </Text>
          <Text
            variant="meta"
            color={booking.dueAtVenue > 0 ? colors.orangeInk : colors.textSecondary}
          >
            {booking.dueAtVenue > 0 ? `${formatPkr(booking.dueAtVenue)} cash` : 'Paid'}
          </Text>
        </View>
      </View>
    );
  }

  const closed = slot.status === 'blocked';

  return (
    <PressableScale
      onPress={closed ? undefined : onAddWalkIn}
      disabled={closed}
      accessibilityLabel={closed ? `${time}, past` : `${time}, free — add a counter booking`}
      style={styles.row}
      testID={`owner-slot-${slot.startAt}`}
    >
      <Text variant="metaStrong" color={colors.textSecondary} style={styles.time}>
        {time}
      </Text>
      <View style={styles.rowBody}>
        <Text variant="bodySmall" color={colors.textSecondary}>
          {closed ? 'Past' : slot.status === 'held' ? 'A player is checking out' : 'Free'}
        </Text>
      </View>
      {closed ? null : (
        <View style={styles.addRow}>
          <Text variant="metaStrong" color={colors.orangeInk}>
            {formatPkr(slot.price)}
          </Text>
          <Icon name="chevron-right" size={s(16)} color={colors.orange} />
        </View>
      )}
    </PressableScale>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryCell} accessible accessibilityLabel={`${value} ${label}`}>
      <Text variant="cardTitle">{value}</Text>
      <Text variant="meta" color={colors.textSecondary}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  notOwner: { padding: spacing.gutter, gap: spacing.md, marginTop: s(48) },
  loader: { marginTop: s(48) },

  dayStrip: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.gutter },
  day: {
    flex: 1,
    height: s(58),
    borderRadius: radius.card,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    gap: s(2),
    ...shadow.card,
  },
  dayActive: { backgroundColor: colors.orange },
  dayNumber: { fontSize: s(16) },

  courts: { paddingHorizontal: spacing.gutter, marginTop: spacing.lg },

  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.gutter,
    marginTop: spacing.lg,
    paddingVertical: spacing.lg,
    borderRadius: radius.card,
    backgroundColor: colors.card,
    ...shadow.card,
  },
  summaryCell: { flex: 1, alignItems: 'center', gap: s(3) },
  summaryRule: { width: StyleSheet.hairlineWidth, height: s(30), backgroundColor: colors.border },

  sheet: { paddingHorizontal: spacing.gutter, paddingTop: spacing.lg, paddingBottom: spacing.xxl },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: s(14) },
  time: { width: s(52) },
  rowBody: { flex: 1, gap: s(3) },
  amount: { alignItems: 'flex-end', gap: s(3) },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: s(6) },
});
