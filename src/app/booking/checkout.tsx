/**
 * Checkout — the single most Pakistan-specific screen in the app.
 *
 * Deposit mode is selected by default. Cash is 75-85% of Pakistani commerce (docs/03
 * §1.1), so demanding full prepayment would lose the majority of bookings; taking a small
 * online advance and leaving the balance at the counter keeps the no-show protection
 * without fighting the culture. Full prepay stays available and is the better default for
 * padel, where the ticket is high and the no-show costs more.
 *
 * The booking intent id is generated once, when the screen mounts, and reused on every
 * retry — that is what makes a second tap on a dropped connection safe.
 */
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/icons';
import { AppBar, Button, Divider, PressableScale, Screen, Text } from '@/components/ui';
import { useCourts, useCreateBooking, useVenue } from '@/data/queries';
import type { PaymentMode, PaymentProvider } from '@/domain/types';
import { formatCountdown, formatSlotShort } from '@/lib/datetime';
import { formatPkr } from '@/lib/money';
import { calculatePayment } from '@/lib/pricing';
import { useGoBack } from '@/lib/navigation';
import { colors, radius, size, spacing } from '@/theme';

import { createIntentId } from '@/features/booking/intent';
import { useCountdown } from '@/features/booking/use-countdown';

const PROVIDERS: { value: PaymentProvider; label: string; hint: string }[] = [
  { value: 'jazzcash', label: 'JazzCash', hint: 'Mobile wallet' },
  { value: 'easypaisa', label: 'Easypaisa', hint: 'Mobile wallet' },
  { value: 'card', label: 'Debit / credit card', hint: 'Visa, Mastercard' },
];

export default function CheckoutScreen() {
  const params = useLocalSearchParams<{
    holdId: string;
    venueId: string;
    courtId: string;
    startAt: string;
    price: string;
    expiresAt: string;
  }>();
  const router = useRouter();
  const goBack = useGoBack('/grounds');

  const [mode, setMode] = useState<PaymentMode>('deposit');
  const [provider, setProvider] = useState<PaymentProvider>('jazzcash');

  // Stable for the life of the screen: every retry must carry the same id.
  const intentId = useMemo(() => createIntentId(), []);

  const venue = useVenue(params.venueId);
  const courts = useCourts(params.venueId);
  const createBooking = useCreateBooking();
  const secondsLeft = useCountdown(params.expiresAt);

  const courtTotal = Number(params.price);
  const breakdown = calculatePayment(courtTotal, mode);
  const court = (courts.data ?? []).find((candidate) => candidate.id === params.courtId);
  const expired = secondsLeft <= 0;

  const pay = () => {
    createBooking.mutate(
      { intentId, holdId: params.holdId, paymentMode: mode, provider },
      {
        onSuccess: (booking) => router.replace(`/booking/${booking.id}`),
      },
    );
  };

  const providerLabel = PROVIDERS.find((each) => each.value === provider)?.label ?? 'card';

  return (
    <Screen>
      <AppBar title="Checkout" onBack={goBack} />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.summary}>
          <Text variant="cardTitle">{venue.data?.name ?? ''}</Text>
          <Text variant="meta" color={colors.textSecondary}>
            {court?.name ?? ''} · {formatSlotShort(params.startAt)}
          </Text>
          <Divider style={styles.divider} />
          <Row label="Court (1 hour)" value={formatPkr(breakdown.courtTotal)} />
          <Row label="Booking fee" value={formatPkr(breakdown.convenienceFee)} />
          <Row label="Total" value={formatPkr(breakdown.total)} strong />
        </View>

        <Text variant="cardTitle" style={styles.sectionTitle}>
          How would you like to pay?
        </Text>

        <Option
          selected={mode === 'deposit'}
          onPress={() => setMode('deposit')}
          title="Deposit now, cash at venue"
          body={`${formatPkr(breakdown.payNow)} online now · ${formatPkr(
            calculatePayment(courtTotal, 'deposit').dueAtVenue,
          )} cash at the counter`}
          testID="mode-deposit"
        />
        <Option
          selected={mode === 'full_prepay'}
          onPress={() => setMode('full_prepay')}
          title="Pay in full"
          body={`${formatPkr(calculatePayment(courtTotal, 'full_prepay').payNow)} now, nothing at the venue`}
          testID="mode-full"
        />

        <View style={styles.payWithHead}>
          <Text variant="cardTitle">Pay with</Text>
          <PressableScale
            onPress={() => router.push('/payment/methods')}
            accessibilityLabel="Manage payment methods"
            testID="manage-methods"
          >
            <Text variant="metaStrong" color={colors.orangeInk} uppercase>
              Manage
            </Text>
          </PressableScale>
        </View>

        {PROVIDERS.map((each) => (
          <Option
            key={each.value}
            selected={provider === each.value}
            onPress={() => setProvider(each.value)}
            title={each.label}
            body={each.hint}
            testID={`provider-${each.value}`}
          />
        ))}

        <View style={styles.policy}>
          <Icon name="shield" size={14} color={colors.orange} bold />
          <Text variant="meta" color={colors.textSecondary} style={styles.policyText}>
            Free cancellation until 6 hours before your slot. 50% up to 2 hours before. The policy
            is fixed at the moment you book and will not change afterwards.
          </Text>
        </View>
      </ScrollView>

      <View style={styles.bottomBar}>
        <View style={styles.holdRow}>
          <Icon name="timer" size={14} color={expired ? colors.danger : colors.orange} />
          <Text variant="meta" color={expired ? colors.danger : colors.textSecondary}>
            {expired
              ? 'Hold expired — please pick the slot again'
              : `Slot held for ${formatCountdown(secondsLeft)}`}
          </Text>
          <Text variant="metaStrong" style={styles.payNow}>
            {formatPkr(breakdown.payNow)}
          </Text>
        </View>

        {createBooking.isError ? (
          <Text variant="meta" color={colors.danger}>
            {expired
              ? 'That slot is no longer held.'
              : 'Payment did not go through. Tap to try again — you will not be charged twice.'}
          </Text>
        ) : null}

        <Button
          label={`Pay with ${providerLabel}`}
          onPress={pay}
          disabled={expired}
          loading={createBooking.isPending}
          testID="pay"
        />
      </View>
    </Screen>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={styles.row}>
      <Text variant={strong ? 'cardTitle' : 'bodySmall'} color={colors.textSecondary}>
        {label}
      </Text>
      <Text variant={strong ? 'cardTitle' : 'bodySmall'}>{value}</Text>
    </View>
  );
}

function Option({
  selected,
  onPress,
  title,
  body,
  testID,
}: {
  selected: boolean;
  onPress: () => void;
  title: string;
  body: string;
  testID?: string;
}) {
  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected, checked: selected }}
      accessibilityLabel={`${title}. ${body}`}
      style={[styles.option, selected && styles.optionSelected]}
      testID={testID}
    >
      <View style={styles.optionText}>
        <Text variant="bodySmall" style={styles.optionTitle}>
          {title}
        </Text>
        <Text variant="meta" color={colors.textSecondary}>
          {body}
        </Text>
      </View>
      <View style={[styles.radio, selected && styles.radioSelected]}>
        {selected ? <Icon name="tick" size={12} color={colors.textOnOrange} /> : null}
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: spacing.gutter,
    paddingBottom: size.bottomBarHeight + spacing.xxl,
    gap: spacing.md,
  },
  summary: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    padding: spacing.xl,
    gap: 6,
  },
  divider: { marginVertical: spacing.md },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { marginTop: spacing.lg },
  payWithHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
  },

  option: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
  },
  optionSelected: { borderColor: colors.orange, backgroundColor: colors.orangeWash },
  optionText: { flex: 1, gap: 3 },
  optionTitle: { lineHeight: 18 },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: { backgroundColor: colors.orange, borderColor: colors.orange },

  policy: { flexDirection: 'row', gap: 6, marginTop: spacing.md },
  policyText: { flex: 1, lineHeight: 16 },

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
    gap: spacing.sm,
  },
  holdRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  payNow: { flex: 1, textAlign: 'right' },
});
