/**
 * Reset password — frame `09_Reset Password`.
 *
 * Measured: title y75, a two-line subtitle at y126, the email field at y190 (327x48), and
 * SEND at y298 (327x58).
 *
 * The success state deliberately does not say whether the address has an account. Telling
 * a stranger which emails are registered turns the form into an account-enumeration oracle.
 */
import { useState } from 'react';
import { KeyboardAvoidingView, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/icons';
import { AppBar, Button, Screen, Text, TextField } from '@/components/ui';
import { useAuth } from '@/features/auth/context';
import { isValidEmail } from '@/features/auth/validation';
import { useGoBack } from '@/lib/navigation';
import { colors, s, spacing } from '@/theme';

export default function ResetPasswordScreen() {
  const goBack = useGoBack('/(auth)/sign-in');
  const { requestPasswordReset } = useAuth();

  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const error = submitted && !isValidEmail(email) ? 'Enter a valid email address' : undefined;

  const submit = async () => {
    setSubmitted(true);
    if (!isValidEmail(email)) return;

    setBusy(true);
    await requestPasswordReset(email);
    setBusy(false);
    setSent(true);
  };

  return (
    <Screen>
      <AppBar title="Reset Password" onBack={goBack} />

      <KeyboardAvoidingView
        style={styles.flex}
        // `padding` on both: leaving Android on `undefined` relies on the window resizing
        // under the keyboard, and SDK 54 draws edge-to-edge, so it no longer does.
        behavior="padding"
      >
        <View style={styles.body}>
          <Text variant="body" color={colors.textSecondary} style={styles.subtitle}>
            Please enter your email address to request a password reset
          </Text>

          <TextField
            icon="mail"
            value={email}
            onChangeText={setEmail}
            placeholder="Type your email"
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            textContentType="emailAddress"
            editable={!sent}
            error={error}
            accessibilityLabel="Email"
            testID="reset-email"
          />

          {sent ? (
            <View style={styles.sent}>
              <Icon name="check-circle" size={20} color={colors.orange} bold />
              <Text variant="bodySmall" color={colors.textSecondary} style={styles.sentText}>
                If an account uses that address, a reset link is on its way. Check your inbox and
                your spam folder.
              </Text>
            </View>
          ) : null}

          <Button
            label={sent ? 'Back to sign in' : 'Send'}
            onPress={sent ? goBack : submit}
            loading={busy}
            style={styles.cta}
            testID="reset-send"
          />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  body: { paddingHorizontal: spacing.gutter },
  // Frame: subtitle at y126, field at y190.
  subtitle: { marginTop: s(31), marginBottom: s(26) },
  sent: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.xl },
  sentText: { flex: 1 },
  // Frame: SEND sits 60 below the field.
  cta: { marginTop: s(60) },
});
