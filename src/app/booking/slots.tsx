/**
 * Slot picker.
 *
 * The kit's calendar frames are raster-only, so this is built from the spec in
 * docs/07 §4: a four-day strip, a priced time grid that shows off-peak against peak, and
 * the five-minute hold made visible.
 *
 * Selecting a slot takes the hold immediately rather than at checkout. The hold is what
 * stops two players paying for the same court, so it has to start the moment a player
 * commits to a time — and the countdown has to be on screen, because a silent expiry at
 * the payment step is how a booking flow loses someone's trust.
 */
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/icons';
import { AppBar, Button, NotFound, PressableScale, Screen, Segmented, Text } from '@/components/ui';
import { useCourts, useHoldSlot, useReleaseHold, useSlots, useVenue } from '@/data/queries';
import type { Slot } from '@/domain/types';
import { formatClock, formatCountdown, formatOpeningHours, toPkt } from '@/lib/datetime';
import { formatPkr } from '@/lib/money';
import { useGoBack } from '@/lib/navigation';
import { colors, radius, shadow, size, spacing } from '@/theme';

import { useCountdown } from '@/features/booking/use-countdown';

const DAYS_AHEAD = 4;
const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function SlotPickerScreen() {
  const { venueId } = useLocalSearchParams<{ venueId: string }>();
  const router = useRouter();
  const goBack = useGoBack('/grounds');

  const venue = useVenue(venueId);
  const courts = useCourts(venueId);

  const [courtId, setCourtId] = useState<string | undefined>(undefined);
  const [dayIndex, setDayIndex] = useState(0);
  const [selected, setSelected] = useState<Slot | null>(null);

  const hold = useHoldSlot();
  const release = useReleaseHold();
  const secondsLeft = useCountdown(hold.data?.expiresAt);

  const days = useMemo(() => {
    const today = new Date();
    return Array.from({ length: DAYS_AHEAD }, (_, offset) => {
      const date = new Date(today);
      date.setDate(date.getDate() + offset);
      return date.toISOString();
    });
  }, []);

  const activeCourtId = courtId ?? courts.data?.[0]?.id;
  const slots = useSlots(activeCourtId, days[dayIndex]);

  const expired = Boolean(hold.data) && secondsLeft <= 0;

  /**
   * Abandons the current hold. Leaving it in place would keep a court the player is no
   * longer looking at off everyone else's screen for the full five minutes — the hold
   * exists to protect a checkout in progress, not to reserve browsing.
   */
  const dropHold = () => {
    if (hold.data) release.mutate(hold.data.id);
    hold.reset();
    setSelected(null);
  };

  const onChangeCourt = (nextCourtId: string) => {
    dropHold();
    setCourtId(nextCourtId);
  };

  const onChangeDay = (nextDayIndex: number) => {
    dropHold();
    setDayIndex(nextDayIndex);
  };

  const onSelectSlot = (slot: Slot) => {
    if (slot.status !== 'available') return;
    if (hold.data) release.mutate(hold.data.id);
    setSelected(slot);
    hold.mutate({ courtId: slot.courtId, startAt: slot.startAt });
  };

  const proceed = () => {
    if (!selected || !hold.data || expired) return;
    router.push({
      pathname: '/booking/checkout',
      params: {
        holdId: hold.data.id,
        venueId,
        courtId: selected.courtId,
        startAt: selected.startAt,
        price: String(selected.price),
        expiresAt: hold.data.expiresAt,
      },
    });
  };

  // Opened without an id — a stale link or a malformed deep link. The venue and court
  // queries are disabled without one, and a disabled query never leaves `pending`, so the
  // grid below would spin indefinitely on a screen that can never load.
  if (!venueId) return <NotFound title="Pick a slot" record="ground" onBack={goBack} />;

  return (
    <Screen>
      <AppBar title="Pick a slot" onBack={goBack} />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text variant="cardTitle">{venue.data?.name ?? 'Loading…'}</Text>
        <Text variant="meta" color={colors.textSecondary} style={styles.venueMeta}>
          {venue.data
            ? `${venue.data.area} · ${formatOpeningHours(venue.data.hours.opensAt, venue.data.hours.closesAt)}`
            : ''}
        </Text>

        {(courts.data?.length ?? 0) > 1 ? (
          <Segmented
            options={(courts.data ?? []).slice(0, 2).map((court) => ({
              value: court.id,
              label: court.name,
            }))}
            value={activeCourtId ?? ''}
            onChange={onChangeCourt}
            testID="court-switch"
          />
        ) : null}

        <View style={styles.dayStrip}>
          {days.map((day, index) => {
            const parts = toPkt(day);
            const active = index === dayIndex;
            return (
              <PressableScale
                key={day}
                onPress={() => onChangeDay(index)}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`${WEEKDAY_SHORT[parts.weekday]} ${parts.day}`}
                style={[styles.day, active && styles.dayActive]}
              >
                <Text variant="meta" color={active ? colors.textOnOrange : colors.textSecondary}>
                  {WEEKDAY_SHORT[parts.weekday]}
                </Text>
                <Text
                  variant="cardTitle"
                  color={active ? colors.textOnOrange : colors.ink}
                  style={styles.dayNumber}
                >
                  {parts.day}
                </Text>
              </PressableScale>
            );
          })}
        </View>

        {slots.isPending ? (
          <ActivityIndicator style={styles.loader} color={colors.orange} />
        ) : (
          <View style={styles.grid}>
            {(slots.data ?? []).map((slot) => {
              const isSelected = selected?.startAt === slot.startAt;
              const disabled = slot.status !== 'available' && !isSelected;

              return (
                <PressableScale
                  key={slot.startAt}
                  onPress={() => onSelectSlot(slot)}
                  disabled={disabled}
                  accessibilityState={{ selected: isSelected, disabled }}
                  accessibilityLabel={
                    disabled
                      ? `${formatClock(slot.startAt)}, ${slot.status === 'booked' ? 'booked' : 'unavailable'}`
                      : `${formatClock(slot.startAt)}, ${formatPkr(slot.price)}${slot.isPeak ? ', peak' : ', off-peak'}`
                  }
                  style={[
                    styles.slot,
                    // Peak slots carry the orange wash so the price difference is visible
                    // before you read it — the legend below promises exactly this.
                    slot.isPeak && styles.slotPeak,
                    isSelected && styles.slotSelected,
                    disabled && styles.slotDisabled,
                  ]}
                  testID={`slot-${slot.startAt}`}
                >
                  <Text
                    variant="cardTitle"
                    // Ink on the orange fill: white would be 2.97:1 on this exact chip,
                    // which carries the time and the price the player is about to pay.
                    color={
                      isSelected
                        ? colors.textOnOrange
                        : disabled
                          ? colors.textSecondary
                          : colors.ink
                    }
                  >
                    {formatClock(slot.startAt)}
                  </Text>
                  <Text
                    variant="meta"
                    color={
                      isSelected
                        ? colors.textOnOrange
                        : slot.isPeak && !disabled
                          ? colors.orangeDeep
                          : colors.textSecondary
                    }
                  >
                    {slot.status === 'booked'
                      ? 'Booked'
                      : slot.status === 'held'
                        ? 'On hold'
                        : formatPkr(slot.price)}
                  </Text>
                </PressableScale>
              );
            })}
          </View>
        )}

        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View style={[styles.swatch, styles.swatchOffPeak]} />
            <Text variant="meta" color={colors.textSecondary}>
              Off-peak
            </Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.swatch, { backgroundColor: colors.orangeWashSolid }]} />
            <Text variant="meta" color={colors.textSecondary}>
              Peak (6 PM – 3 AM)
            </Text>
          </View>
        </View>
      </ScrollView>

      <View style={styles.bottomBar}>
        {selected ? (
          <View style={styles.holdRow}>
            <Icon name="timer" size={14} color={expired ? colors.danger : colors.orange} />
            <Text variant="meta" color={expired ? colors.danger : colors.textSecondary}>
              {expired
                ? 'Hold expired — pick the slot again'
                : `Slot held for ${formatCountdown(secondsLeft)}`}
            </Text>
            <Text variant="metaStrong" style={styles.total}>
              {formatPkr(selected.price)}
            </Text>
          </View>
        ) : null}
        <Button
          label={selected ? 'Continue to payment' : 'Select a slot'}
          disabled={!selected || expired || hold.isPending}
          loading={hold.isPending}
          onPress={proceed}
          testID="continue-to-payment"
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: spacing.gutter,
    paddingBottom: size.bottomBarHeight + spacing.xxl,
    gap: spacing.lg,
  },
  venueMeta: { marginTop: -spacing.sm },
  dayStrip: { flexDirection: 'row', gap: spacing.md },
  day: {
    flex: 1,
    height: 64,
    borderRadius: radius.card,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    ...shadow.card,
  },
  dayActive: { backgroundColor: colors.orange },
  dayNumber: { fontSize: 16 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  slot: {
    // Three per row inside the 327px content column.
    width: (size.contentWidth - spacing.md * 2) / 3,
    height: 58,
    borderRadius: radius.card,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    ...shadow.card,
  },
  slotPeak: { backgroundColor: colors.orangeWashSolid },
  slotSelected: { backgroundColor: colors.orange },
  slotDisabled: { backgroundColor: colors.surfaceMuted, opacity: 0.7 },

  legend: { flexDirection: 'row', gap: spacing.xl, marginTop: spacing.sm },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  swatch: { width: 12, height: 12, borderRadius: 4 },
  swatchOffPeak: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },

  loader: { marginTop: spacing.xxl },

  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.gutter,
    paddingTop: spacing.lg,
    paddingBottom: spacing.gutter,
    backgroundColor: colors.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    gap: spacing.md,
  },
  holdRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  total: { flex: 1, textAlign: 'right' },
});
