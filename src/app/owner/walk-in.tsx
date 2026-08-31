/**
 * Record a counter booking — the walk-in flow from docs/04 §7: "Owner app → calendar → tap
 * empty slot → manual booking → name/phone → slot blocked everywhere instantly."
 *
 * The last three words are the feature. This runs through `createManualBooking`, which
 * takes the same slot check an app booking faces (docs/05 §5.1), so a court cannot be sold
 * at the counter and in the app at the same time. Everything else here is data entry.
 */
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, ScrollView, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/icons';
import { AppBar, Button, Screen, Text, TextField } from '@/components/ui';
import { ApiError } from '@/data/api';
import { useCourts, useCreateManualBooking, useVenue } from '@/data/queries';
import { isValidPhone, normalisePhone } from '@/features/auth/validation';
import { formatSlotShort } from '@/lib/datetime';
import { formatPkr } from '@/lib/money';
import { useGoBack } from '@/lib/navigation';
import { colors, radius, s, spacing } from '@/theme';

export default function WalkInScreen() {
  const { venueId, courtId, startAt, price } = useLocalSearchParams<{
    venueId: string;
    courtId: string;
    startAt: string;
    price?: string;
  }>();
  const goBack = useGoBack('/owner/dashboard');

  const venue = useVenue(venueId);
  const courts = useCourts(venueId);
  const create = useCreateManualBooking();

  const court = (courts.data ?? []).find((candidate) => candidate.id === courtId);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [amount, setAmount] = useState(price ?? '');
  const [submitted, setSubmitted] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const nameError = submitted && name.trim().length < 2 ? 'Enter a name' : undefined;
  // A number is how the owner reaches them if the slot has to move, so it is required.
  const phoneError =
    submitted && !isValidPhone(phone) ? 'Enter a 10-digit mobile number' : undefined;

  const save = () => {
    setSubmitted(true);
    setFailure(null);
    if (name.trim().length < 2 || !isValidPhone(phone)) return;

    const override = amount.replace(/\D/g, '');
    create.mutate(
      {
        venueId,
        courtId,
        startAt,
        customerName: name,
        customerPhone: `+92${normalisePhone(phone)}`,
        price: override ? Number(override) : undefined,
      },
      {
        onSuccess: goBack,
        onError: (error) => {
          if (error instanceof ApiError && error.code === 'slot_taken') {
            setFailure('That slot has just gone. Refresh the sheet and pick another.');
            return;
          }
          setFailure('We could not save that booking. Try again.');
        },
      },
    );
  };

  return (
    <Screen>
      <AppBar title="Counter booking" onBack={goBack} />

      <KeyboardAvoidingView
        style={styles.flex}
        // `padding` on both: leaving Android on `undefined` relies on the window resizing
        // under the keyboard, and SDK 54 draws edge-to-edge, so it no longer does.
        behavior="padding"
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.summary}>
            <Text variant="cardTitle">{venue.data?.name ?? ''}</Text>
            <Text variant="meta" color={colors.textSecondary}>
              {court?.name ?? ''} · {startAt ? formatSlotShort(startAt) : ''}
            </Text>
          </View>

          <Label>Customer name</Label>
          <TextField
            icon="profile"
            value={name}
            onChangeText={setName}
            placeholder="Who is the slot for?"
            autoCapitalize="words"
            error={nameError}
            accessibilityLabel="Customer name"
            testID="walkin-name"
          />

          <Label>Mobile number</Label>
          <TextField
            icon="call"
            prefix="+92"
            value={phone}
            onChangeText={setPhone}
            placeholder="300 1234567"
            keyboardType="phone-pad"
            maxLength={13}
            error={phoneError}
            accessibilityLabel="Customer mobile number"
            testID="walkin-phone"
          />

          <Label>Amount</Label>
          <TextField
            icon="wallet"
            prefix="Rs"
            value={amount}
            onChangeText={setAmount}
            placeholder={price ? formatPkr(Number(price)).replace('Rs ', '') : 'Court rate'}
            keyboardType="number-pad"
            accessibilityLabel="Amount charged"
            testID="walkin-amount"
          />
          <Text variant="meta" color={colors.textSecondary} style={styles.hint}>
            Leave it blank to charge this slot&apos;s usual rate.
          </Text>

          <View style={styles.notice}>
            <Icon name="shield" size={s(16)} color={colors.orange} bold />
            <Text variant="meta" color={colors.textSecondary} style={styles.noticeText}>
              Saving blocks this slot in the app straight away, so nobody can book a court you have
              already given away. The full amount is recorded as cash at the counter.
            </Text>
          </View>

          {failure ? (
            <Text variant="meta" color={colors.danger} style={styles.failure}>
              {failure}
            </Text>
          ) : null}
        </ScrollView>

        <View style={styles.footer}>
          <Button
            label="Save booking"
            onPress={save}
            loading={create.isPending}
            testID="walkin-save"
          />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function Label({ children }: { children: string }) {
  return (
    <Text variant="cardTitle" style={styles.label}>
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { paddingHorizontal: spacing.gutter, paddingBottom: spacing.xxl },
  summary: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    padding: spacing.lg,
    gap: s(6),
    marginTop: spacing.md,
  },
  label: { marginTop: spacing.xl, marginBottom: spacing.md },
  hint: { marginTop: spacing.sm, marginLeft: s(4) },
  notice: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.gutter },
  noticeText: { flex: 1, lineHeight: s(16) },
  failure: { marginTop: spacing.md },
  footer: { paddingHorizontal: spacing.gutter, paddingBottom: spacing.xxl, paddingTop: spacing.md },
});
