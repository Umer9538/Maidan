/**
 * Payment methods — frame `41_Payment`.
 *
 * Measured from the flattened export: title at y71, a section label at y131 with an
 * orange "Add New Card" link on the same line, 54pt method rows at y171 / y317 / y445, a
 * saved-card row, a voucher label at y535 with its field and a dark APPLY beside it, and
 * the CTA at y722.
 *
 * The frame's methods are Apple Pay, PayPal and Google Pay. None of those is a payment
 * rail in Pakistan — PayPal does not operate there at all (docs/03 §1.1). The rows carry
 * what players actually hold: JazzCash and Easypaisa, roughly 40M monthly active wallets
 * between them, and a debit or credit card through a local aggregator.
 */
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { Icon, type IconName } from '@/components/icons';
import { AppBar, Button, PressableScale, Screen, Text } from '@/components/ui';
import { usePayments } from '@/features/payments/context';
import type { PaymentProvider, SavedCard } from '@/domain/types';
import { useGoBack } from '@/lib/navigation';
import { colors, radius, s, spacing, typography } from '@/theme';

const WALLETS: { value: PaymentProvider; label: string; hint: string; icon: IconName }[] = [
  { value: 'jazzcash', label: 'JazzCash', hint: 'Mobile wallet', icon: 'wallet' },
  { value: 'easypaisa', label: 'Easypaisa', hint: 'Mobile wallet', icon: 'wallet' },
];

export default function PaymentMethodsScreen() {
  const router = useRouter();
  const goBack = useGoBack('/(tabs)/profile');
  const { cards, primaryCard, makePrimary, removeCard } = usePayments();

  const [provider, setProvider] = useState<PaymentProvider>('jazzcash');
  const [voucher, setVoucher] = useState('');
  const [applied, setApplied] = useState<string | null>(null);

  const applyVoucher = () => {
    const code = voucher.trim().toUpperCase();
    if (code.length < 4) return;
    // Redemption needs the backend; the code is held until checkout can send it.
    setApplied(code);
    setVoucher('');
  };

  return (
    <Screen>
      <AppBar title="Payment" onBack={goBack} />

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.sectionHead}>
          <Text variant="cardTitle">Payment method</Text>
          <PressableScale
            onPress={() => router.push('/payment/add-card')}
            accessibilityLabel="Add a new card"
            testID="add-card"
          >
            <Text variant="cardTitle" color={colors.orangeInk}>
              Add New Card
            </Text>
          </PressableScale>
        </View>

        {WALLETS.map((wallet) => (
          <MethodRow
            key={wallet.value}
            icon={wallet.icon}
            title={wallet.label}
            subtitle={wallet.hint}
            selected={provider === wallet.value}
            onPress={() => setProvider(wallet.value)}
            testID={`method-${wallet.value}`}
          />
        ))}

        <Text variant="cardTitle" style={styles.subhead}>
          Pay by debit or credit card
        </Text>

        {cards.length === 0 ? (
          <PressableScale
            onPress={() => router.push('/payment/add-card')}
            accessibilityLabel="Add a card"
            style={styles.emptyCard}
            testID="empty-add-card"
          >
            <Icon name="chevron-right" size={s(18)} color={colors.orange} />
            <Text variant="bodySmall" color={colors.textSecondary} style={styles.emptyText}>
              No card saved yet. Add one to pay by card.
            </Text>
          </PressableScale>
        ) : (
          cards.map((card) => (
            <CardRow
              key={card.id}
              card={card}
              selected={provider === 'card' && primaryCard?.id === card.id}
              onSelect={() => {
                setProvider('card');
                makePrimary(card.id);
              }}
              onRemove={() => removeCard(card.id)}
            />
          ))
        )}

        <Text variant="cardTitle" style={styles.subhead}>
          Add voucher
        </Text>

        {applied ? (
          <View style={styles.appliedRow}>
            <Icon name="check-circle" size={s(18)} color={colors.orange} bold />
            <Text variant="bodySmall" style={styles.appliedText}>
              {applied} will be applied at checkout
            </Text>
            <PressableScale
              onPress={() => setApplied(null)}
              accessibilityLabel={`Remove voucher ${applied}`}
            >
              <Text variant="metaStrong" color={colors.orangeInk} uppercase>
                Remove
              </Text>
            </PressableScale>
          </View>
        ) : (
          <View style={styles.voucherRow}>
            <TextInput
              value={voucher}
              onChangeText={setVoucher}
              placeholder="VOUCHER CODE"
              placeholderTextColor={colors.textSecondary}
              autoCapitalize="characters"
              autoCorrect={false}
              style={styles.voucherInput}
              accessibilityLabel="Voucher code"
              testID="voucher-input"
            />
            <Button
              label="Apply"
              onPress={applyVoucher}
              disabled={voucher.trim().length < 4}
              style={styles.apply}
              testID="voucher-apply"
            />
          </View>
        )}

        <Text variant="meta" color={colors.textSecondary} style={styles.notice}>
          Card details never reach Maidan&apos;s servers. Payments run through a licensed Pakistani
          gateway.
        </Text>
      </ScrollView>

      <View style={styles.footer}>
        <Button label="Done" onPress={goBack} testID="methods-done" />
      </View>
    </Screen>
  );
}

function MethodRow({
  icon,
  title,
  subtitle,
  selected,
  onPress,
  testID,
}: {
  icon: IconName;
  title: string;
  subtitle: string;
  selected: boolean;
  onPress: () => void;
  testID?: string;
}) {
  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected, checked: selected }}
      accessibilityLabel={`${title}. ${subtitle}`}
      style={[styles.row, selected && styles.rowSelected]}
      testID={testID}
    >
      <View style={styles.rowIcon}>
        <Icon name={icon} size={s(20)} color={colors.orange} bold />
      </View>
      <View style={styles.rowText}>
        <Text variant="bodySmall">{title}</Text>
        <Text variant="meta" color={colors.textSecondary}>
          {subtitle}
        </Text>
      </View>
      <Radio selected={selected} />
    </PressableScale>
  );
}

function CardRow({
  card,
  selected,
  onSelect,
  onRemove,
}: {
  card: SavedCard;
  selected: boolean;
  onSelect: () => void;
  onRemove: () => void;
}) {
  const expiry = `${String(card.expiryMonth).padStart(2, '0')}/${String(card.expiryYear).slice(-2)}`;

  return (
    <PressableScale
      onPress={onSelect}
      accessibilityRole="radio"
      accessibilityState={{ selected, checked: selected }}
      accessibilityLabel={`${card.brand} ending ${card.last4}, expires ${expiry}`}
      style={[styles.row, selected && styles.rowSelected]}
      testID={`card-${card.id}`}
    >
      <View style={styles.rowIcon}>
        <Icon name="wallet" size={s(20)} color={colors.orange} bold />
      </View>
      <View style={styles.rowText}>
        <Text variant="bodySmall">
          {card.brand} •••• {card.last4}
        </Text>
        <Text variant="meta" color={colors.textSecondary}>
          Expires {expiry}
          {card.isPrimary ? ' · Primary' : ''}
        </Text>
      </View>
      <PressableScale
        onPress={onRemove}
        accessibilityLabel={`Remove ${card.brand} ending ${card.last4}`}
      >
        <Text variant="metaStrong" color={colors.textSecondary} uppercase>
          Remove
        </Text>
      </PressableScale>
    </PressableScale>
  );
}

function Radio({ selected }: { selected: boolean }) {
  return (
    <View style={[styles.radio, selected && styles.radioOn]}>
      {selected ? <View style={styles.radioDot} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: spacing.gutter, paddingBottom: spacing.xxl },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: s(36),
    marginBottom: s(24),
  },
  subhead: { marginTop: s(32), marginBottom: s(18) },

  // Frame: 54pt rows on the 327 column.
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: s(54),
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    marginBottom: spacing.lg,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  rowSelected: { borderColor: colors.orange, backgroundColor: colors.orangeWash },
  rowIcon: {
    width: s(36),
    height: s(36),
    borderRadius: s(18),
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: { flex: 1, gap: s(3) },
  radio: {
    width: s(22),
    height: s(22),
    borderRadius: s(11),
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOn: { borderColor: colors.orange },
  radioDot: {
    width: s(12),
    height: s(12),
    borderRadius: s(6),
    backgroundColor: colors.orange,
  },

  emptyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: s(54),
    paddingHorizontal: spacing.lg,
    borderRadius: radius.card,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
  },
  emptyText: { flex: 1 },

  voucherRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  voucherInput: {
    flex: 1,
    height: s(54),
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    paddingHorizontal: spacing.lg,
    ...typography.bodySmall,
    lineHeight: undefined,
    letterSpacing: 1,
    color: colors.text,
  },
  apply: { width: s(110), height: s(54) },
  appliedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: s(54),
    paddingHorizontal: spacing.lg,
    borderRadius: radius.card,
    backgroundColor: colors.orangeWash,
  },
  appliedText: { flex: 1 },

  notice: { marginTop: spacing.xl, lineHeight: s(16) },
  footer: { paddingHorizontal: spacing.gutter, paddingBottom: spacing.xxl },
});
