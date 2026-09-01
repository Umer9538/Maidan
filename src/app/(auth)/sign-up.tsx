/**
 * Sign up — frame `07_Sign up`.
 *
 * Geometry measured from the flattened export:
 *   title y74 · subtitle y126 · fields at y168 / 232 / 296 / 360, each 327x48 with a 16
 *   gap · CTA y440 (327x58) · "or continue with" y554 · social y619 · footer y737
 *
 * The frame has four fields (name, email, password, confirm). A fifth carries the mobile
 * number, on the same 16pt rhythm, which pushes the CTA down one row. The number is not
 * decoration: booking confirmations go out over SMS and WhatsApp (docs/04 §4), and the
 * code screen that follows verifies it.
 */
import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, ScrollView, StyleSheet, View } from 'react-native';

import {
  AppBar,
  Button,
  PressableScale,
  Screen,
  SocialRow,
  Text,
  TextField,
} from '@/components/ui';
import { useAuth } from '@/features/auth/context';
import {
  describePasswordRule,
  isValidEmail,
  isValidPassword,
  isValidPhone,
} from '@/features/auth/validation';
import { useGoBack } from '@/lib/navigation';
import { colors, s, spacing } from '@/theme';

export default function SignUpScreen() {
  const router = useRouter();
  const goBack = useGoBack('/(auth)/sign-in');
  const { signUp } = useAuth();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const nameError = submitted && fullName.trim().length < 2 ? 'Enter your name' : undefined;
  const emailError = submitted && !isValidEmail(email) ? 'Enter a valid email address' : undefined;
  const phoneError =
    submitted && !isValidPhone(phone) ? 'Enter a 10-digit mobile number' : undefined;
  const passwordError =
    submitted && !isValidPassword(password) ? describePasswordRule() : undefined;
  const confirmError = submitted && confirm !== password ? 'Passwords do not match' : undefined;

  const valid =
    fullName.trim().length >= 2 &&
    isValidEmail(email) &&
    isValidPhone(phone) &&
    isValidPassword(password) &&
    confirm === password;

  const submit = async () => {
    setSubmitted(true);
    setFailure(null);
    if (!valid) return;

    setBusy(true);
    const error = await signUp({ fullName, email, phone, password });
    setBusy(false);

    if (error === 'email_taken') {
      setFailure('An account already uses that email. Sign in instead.');
      return;
    }
    if (error) {
      setFailure('We could not create your account. Try again.');
      return;
    }
    router.push('/(auth)/verification');
  };

  return (
    <Screen>
      <AppBar title="Sign up" onBack={goBack} />

      <KeyboardAvoidingView
        style={styles.flex}
        // `padding` on both: leaving Android on `undefined` relies on the window resizing
        // under the keyboard, and SDK 54 draws edge-to-edge, so it no longer does.
        behavior="padding"
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Text variant="body" color={colors.textSecondary} style={styles.subtitle}>
            Create an account and start booking
          </Text>

          <View style={styles.fields}>
            <TextField
              icon="profile"
              value={fullName}
              onChangeText={setFullName}
              placeholder="Type your full name"
              autoCapitalize="words"
              autoComplete="name"
              textContentType="name"
              error={nameError}
              accessibilityLabel="Full name"
              testID="full-name"
            />
            <TextField
              icon="mail"
              value={email}
              onChangeText={setEmail}
              placeholder="Type your email"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              textContentType="emailAddress"
              error={emailError}
              accessibilityLabel="Email"
              testID="email"
            />
            <TextField
              icon="call"
              prefix="+92"
              value={phone}
              onChangeText={setPhone}
              placeholder="300 1234567"
              keyboardType="phone-pad"
              autoComplete="tel"
              textContentType="telephoneNumber"
              maxLength={13}
              error={phoneError}
              accessibilityLabel="Mobile number"
              testID="phone"
            />
            <TextField
              icon="lock"
              secure
              value={password}
              onChangeText={setPassword}
              placeholder="Type your password"
              autoCapitalize="none"
              autoComplete="new-password"
              textContentType="newPassword"
              error={passwordError}
              accessibilityLabel="Password"
              testID="password"
            />
            <TextField
              icon="lock"
              secure
              value={confirm}
              onChangeText={setConfirm}
              placeholder="Type your confirm password"
              autoCapitalize="none"
              autoComplete="new-password"
              error={confirmError}
              accessibilityLabel="Confirm password"
              testID="confirm"
            />
          </View>

          {failure ? (
            <Text variant="meta" color={colors.danger} style={styles.failure}>
              {failure}
            </Text>
          ) : null}

          <Button
            label="Sign up"
            onPress={submit}
            loading={busy}
            style={styles.cta}
            testID="sign-up"
          />

          <View style={styles.social}>
            <SocialRow
              providers={[
                // See sign-in: no OAuth exchange yet, so there is nothing behind it.
                { name: 'google', label: 'Continue with Google' },
              ]}
            />
          </View>

          <View style={styles.footer}>
            <Text variant="bodySmall" color={colors.textSecondary}>
              Already have an account?{' '}
            </Text>
            <Link href="/(auth)/sign-in" asChild>
              <PressableScale accessibilityLabel="Sign in">
                <Text variant="bodySmall" color={colors.orangeInk}>
                  Sign In
                </Text>
              </PressableScale>
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { paddingHorizontal: spacing.gutter, paddingBottom: spacing.xxl },
  subtitle: { marginTop: s(31), marginBottom: s(28) },
  fields: { gap: s(16) },
  failure: { marginTop: spacing.md },
  // Frame: CTA sits 32 below the last field.
  cta: { marginTop: s(32) },
  social: { marginTop: s(56) },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: s(64),
  },
});
