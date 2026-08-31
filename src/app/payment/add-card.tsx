/**
 * Add card — frame `43_Add New Card`.
 *
 * Measured from the flattened export: an orange sheet with a drag handle at y50, the
 * "Card Number" label at y403 with its 327x54 field at y435, "Expires End" and "CVV"
 * labels at y524 with two side-by-side fields at y553, a "Save as a primary card" check,
 * and a white CONTINUE at y722.
 *
 * The sheet is brand orange, so every label and value on it is ink rather than white —
 * white on #F76B10 is 2.97:1, and a card number is the least forgiving text in the app to
 * misread. The frame prints it white; that is the one thing here not reproduced.
 *
 * Nothing typed on this screen is stored. The number is validated locally to catch a typo
 * before a round trip, then reduced to a brand, the last four digits and an expiry.
 */
import { useState } from 'react';
import { KeyboardAvoidingView, StyleSheet, TextInput, View } from 'react-native';

import { Icon } from '@/components/icons';
import { Button, PressableScale, Screen, Text } from '@/components/ui';
import { usePayments } from '@/features/payments/context';
import {
  BRAND_LABELS,
  detectBrand,
  formatCardNumber,
  formatExpiry,
  isValidCardNumber,
  isValidCvv,
  isValidExpiry,
  lastFour,
} from '@/lib/cards';
import { useGoBack } from '@/lib/navigation';
import { colors, radius, s, spacing, typography } from '@/theme';

export default function AddCardScreen() {
  const goBack = useGoBack('/payment/methods');
  const { addCard } = usePayments();

  const [number, setNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvv, setCvv] = useState('');
  const [primary, setPrimary] = useState(true);
  const [submitted, setSubmitted] = useState(false);

  const brand = detectBrand(number);
  const numberError = submitted && !isValidCardNumber(number) ? 'Check the card number' : undefined;
  const expiryError = submitted && !isValidExpiry(expiry) ? 'Check the expiry' : undefined;
  const cvvError = submitted && !isValidCvv(cvv, brand) ? 'Check the code' : undefined;

  const save = () => {
    setSubmitted(true);
    if (!isValidCardNumber(number) || !isValidExpiry(expiry) || !isValidCvv(cvv, brand)) return;

    const digits = expiry.replace(/\D/g, '');
    addCard({
      brand: BRAND_LABELS[brand],
      last4: lastFour(number),
      expiryMonth: Number(digits.slice(0, 2)),
      expiryYear: 2000 + Number(digits.slice(2)),
      makePrimary: primary,
    });
    // The card number never leaves this screen.
    setNumber('');
    setCvv('');
    goBack();
  };

  return (
    <Screen background={colors.orange} statusBarStyle="dark">
      <KeyboardAvoidingView
        style={styles.flex}
        // `padding` on both: leaving Android on `undefined` relies on the window resizing
        // under the keyboard, and SDK 54 draws edge-to-edge, so it no longer does.
        behavior="padding"
      >
        <View style={styles.handleRow}>
          <View style={styles.handle} />
        </View>

        <View style={styles.body}>
          <Text variant="screenTitle" color={colors.textOnOrange}>
            Card Number
          </Text>
          <TextInput
            value={formatCardNumber(number)}
            onChangeText={setNumber}
            placeholder="0000 0000 0000 0000"
            placeholderTextColor="rgba(32, 34, 44, 0.45)"
            keyboardType="number-pad"
            autoComplete="cc-number"
            textContentType="creditCardNumber"
            maxLength={23}
            style={[styles.input, styles.numberInput]}
            accessibilityLabel="Card number"
            testID="card-number"
          />
          <FieldError message={numberError} />

          <View style={styles.pairRow}>
            <View style={styles.pair}>
              <Text variant="screenTitle" color={colors.textOnOrange} style={styles.pairLabel}>
                Expires End
              </Text>
              <TextInput
                value={formatExpiry(expiry)}
                onChangeText={setExpiry}
                placeholder="MM/YY"
                placeholderTextColor="rgba(32, 34, 44, 0.45)"
                keyboardType="number-pad"
                maxLength={5}
                style={styles.input}
                accessibilityLabel="Expiry date"
                testID="card-expiry"
              />
              <FieldError message={expiryError} />
            </View>

            <View style={styles.pair}>
              <Text variant="screenTitle" color={colors.textOnOrange} style={styles.pairLabel}>
                CVV
              </Text>
              <TextInput
                value={cvv}
                onChangeText={(value) => setCvv(value.replace(/\D/g, ''))}
                placeholder={brand === 'amex' ? '0000' : '000'}
                placeholderTextColor="rgba(32, 34, 44, 0.45)"
                keyboardType="number-pad"
                secureTextEntry
                maxLength={4}
                style={styles.input}
                accessibilityLabel="Security code"
                testID="card-cvv"
              />
              <FieldError message={cvvError} />
            </View>
          </View>

          <PressableScale
            onPress={() => setPrimary((current) => !current)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: primary }}
            accessibilityLabel="Save as a primary card"
            style={styles.checkRow}
            testID="card-primary"
          >
            <View style={[styles.check, primary && styles.checkOn]}>
              {primary ? <Icon name="tick" size={s(12)} color={colors.orange} /> : null}
            </View>
            <Text variant="body" color={colors.textOnOrange}>
              Save as a primary card
            </Text>
          </PressableScale>
        </View>

        <View style={styles.footer}>
          <Text variant="meta" color={colors.textOnOrange} style={styles.notice}>
            Card details go straight to our payment provider. Maidan stores only the brand, the last
            four digits and the expiry.
          </Text>
          <Button
            label="Continue"
            variant="secondary"
            style={styles.cta}
            onPress={save}
            testID="card-save"
          />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <Text variant="meta" color={colors.ink} style={styles.error}>
      {message}
    </Text>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  handleRow: { alignItems: 'center', paddingTop: s(14) },
  handle: {
    width: s(43),
    height: s(5),
    borderRadius: s(3),
    backgroundColor: 'rgba(32, 34, 44, 0.25)',
  },
  body: { flex: 1, paddingHorizontal: spacing.gutter, paddingTop: s(40) },

  input: {
    height: s(54),
    borderRadius: radius.card,
    // A lighter wash of the sheet's own orange, as the frame draws it.
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    paddingHorizontal: spacing.lg,
    marginTop: s(16),
    ...typography.body,
    // The shared line height clips descenders inside a TextInput.
    lineHeight: undefined,
    color: colors.ink,
  },
  numberInput: { letterSpacing: 1 },
  pairRow: { flexDirection: 'row', gap: spacing.lg, marginTop: s(35) },
  pair: { flex: 1 },
  pairLabel: { fontSize: s(18), lineHeight: s(24) },
  error: { marginTop: s(6), marginLeft: s(4) },

  checkRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: s(34) },
  check: {
    width: s(24),
    height: s(24),
    borderRadius: s(12),
    borderWidth: 1.5,
    borderColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkOn: { backgroundColor: colors.white, borderColor: colors.white },

  footer: { paddingHorizontal: spacing.gutter, paddingBottom: spacing.xxl, gap: spacing.lg },
  notice: { lineHeight: s(16), opacity: 0.85 },
  cta: { backgroundColor: colors.white, borderColor: colors.white },
});
