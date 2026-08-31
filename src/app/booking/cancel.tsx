/**
 * Cancel a booking.
 *
 * The refund rules were written and tested from the start but had no way in — a player
 * could book and then had no way out, which is the kind of dead end that generates support
 * calls rather than cancellations.
 *
 * The refund is computed from the policy snapshotted on the booking, never today's policy
 * (docs/05 §5.2), and only against what was actually collected online. Cash at the counter
 * was never ours to refund, and the screen says so rather than implying a number we cannot
 * pay back.
 */
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/icons';
import { AppBar, Button, Divider, EmptyState, NotFound, Screen, Text } from '@/components/ui';
import { useBooking, useCancelBooking, useCourts, useVenue } from '@/data/queries';
import { describePolicy, resolveRefund } from '@/lib/cancellation';
import { formatSlotShort, hoursUntil } from '@/lib/datetime';
import { formatPkr } from '@/lib/money';
import { useGoBack } from '@/lib/navigation';
import { colors, radius, s, spacing } from '@/theme';

export default function CancelBookingScreen() {
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
  const router = useRouter();
  const goBack = useGoBack('/bookings');

  const booking = useBooking(bookingId);
  const venue = useVenue(booking.data?.venueId ?? '');
  const courts = useCourts(booking.data?.venueId ?? '');
  const cancel = useCancelBooking();
  const [failure, setFailure] = useState<string | null>(null);

  // Opened without an id — a stale link or a malformed deep link. The query behind this
  // screen is disabled without one, and a disabled query stays pending forever, so the
  // spinner below would never clear.
  if (!bookingId) return <NotFound title="Cancel booking" record="booking" onBack={goBack} />;

  if (booking.isPending) {
    return (
      <Screen>
        <ActivityIndicator style={styles.loader} color={colors.orange} />
      </Screen>
    );
  }

  if (!booking.data) {
    return (
      <Screen>
        <AppBar title="Cancel booking" onBack={goBack} />
        <EmptyState icon="calendar" title="Booking not found" body="It may already be cancelled." />
      </Screen>
    );
  }

  const data = booking.data;
  const court = (courts.data ?? []).find((candidate) => candidate.id === data.courtId);
  const refund = resolveRefund(data);
  const hoursLeft = hoursUntil(data.startAt);
  const alreadyCancelled = data.status === 'cancelled';
  const played = data.status === 'completed';

  const confirm = () => {
    setFailure(null);
    cancel.mutate(bookingId, {
      onSuccess: () => router.replace('/bookings'),
      onError: () => setFailure('We could not cancel that. Try again.'),
    });
  };

  return (
    <Screen>
      <AppBar title="Cancel booking" onBack={goBack} />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.summary}>
          <Text variant="cardTitle">{venue.data?.name ?? ''}</Text>
          <Text variant="meta" color={colors.textSecondary}>
            {court?.name ?? ''} · {formatSlotShort(data.startAt)}
          </Text>
        </View>

        {played || alreadyCancelled ? (
          <View style={styles.notice}>
            <Icon name="shield" size={s(18)} color={colors.textSecondary} bold />
            <Text variant="bodySmall" color={colors.textSecondary} style={styles.noticeText}>
              {alreadyCancelled
                ? 'This booking is already cancelled.'
                : 'This slot has already been played, so there is nothing to cancel.'}
            </Text>
          </View>
        ) : (
          <>
            <Text variant="cardTitle" style={styles.sectionTitle}>
              What you get back
            </Text>

            <View style={styles.refund}>
              <Row label="You paid online" value={formatPkr(data.paidOnline)} />
              <Row
                label={`Refund (${refund.refundPercent}%)`}
                value={formatPkr(refund.refundAmount)}
                emphasis
              />
              {data.dueAtVenue > 0 ? (
                <Row label="Cash at the counter" value="Never charged" muted />
              ) : null}
            </View>

            <View style={styles.notice}>
              <Icon name="timer" size={s(16)} color={colors.orange} />
              <Text variant="meta" color={colors.textSecondary} style={styles.noticeText}>
                {hoursLeft > 0
                  ? `Your slot is in ${Math.floor(hoursLeft)} hours. The policy on this booking is: ${describePolicy(data.cancellationPolicy)}.`
                  : `Your slot has started, so no refund applies. The policy on this booking is: ${describePolicy(data.cancellationPolicy)}.`}
              </Text>
            </View>

            <Divider style={styles.divider} />

            <Text variant="meta" color={colors.textSecondary} style={styles.freeing}>
              Cancelling puts the slot straight back on sale, so another player can take it.
            </Text>
          </>
        )}

        {failure ? (
          <Text variant="meta" color={colors.danger} style={styles.failure}>
            {failure}
          </Text>
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        {played || alreadyCancelled ? (
          <Button label="Back" variant="secondary" onPress={goBack} testID="cancel-back" />
        ) : (
          <>
            <Button label="Keep my booking" variant="soft" onPress={goBack} testID="cancel-keep" />
            <Button
              label={
                refund.refundAmount > 0
                  ? `Cancel · refund ${formatPkr(refund.refundAmount)}`
                  : 'Cancel with no refund'
              }
              onPress={confirm}
              loading={cancel.isPending}
              testID="cancel-confirm"
            />
          </>
        )}
      </View>
    </Screen>
  );
}

function Row({
  label,
  value,
  emphasis,
  muted,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
  muted?: boolean;
}) {
  return (
    <View style={styles.row}>
      <Text variant="bodySmall" color={colors.textSecondary}>
        {label}
      </Text>
      <Text
        variant={emphasis ? 'cardTitle' : 'bodySmall'}
        color={emphasis ? colors.orangeInk : muted ? colors.textSecondary : colors.ink}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  loader: { marginTop: s(48) },
  scroll: { paddingHorizontal: spacing.gutter, paddingBottom: spacing.xxl },
  summary: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    padding: spacing.lg,
    gap: s(6),
    marginTop: spacing.md,
  },
  sectionTitle: { marginTop: spacing.gutter, marginBottom: spacing.md },
  refund: {
    padding: spacing.lg,
    borderRadius: radius.card,
    backgroundColor: colors.card,
    gap: spacing.md,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  notice: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.xl },
  noticeText: { flex: 1, lineHeight: s(17) },
  divider: { marginVertical: spacing.xl },
  freeing: { lineHeight: s(16) },
  failure: { marginTop: spacing.md },
  footer: {
    paddingHorizontal: spacing.gutter,
    paddingBottom: spacing.xxl,
    paddingTop: spacing.md,
    gap: spacing.md,
  },
});
