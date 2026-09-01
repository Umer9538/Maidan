/**
 * Sign in — frame `06_Sign in`.
 *
 * Geometry measured from the flattened export (the frame carries no layers):
 *   title y74 · subtitle y126 · email y168 (327x48) · password y232 · row y302 (19 tall)
 *   CTA y382 (327x58) · "or continue with" y554 · social y619 (54 tall) · footer y737
 */
import { Link, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, ScrollView, StyleSheet, View } from 'react-native';

import {
  AppBar,
  Button,
  PressableScale,
  Screen,
  SocialRow,
  Text,
  TextField,
  Toggle,
} from '@/components/ui';
import { useAuth, type AuthError } from '@/features/auth/context';
import { isValidEmail, isValidPassword } from '@/features/auth/validation';
import { colors, s, spacing } from '@/theme';

const FAILURES: Record<AuthError, string> = {
  invalid_credentials: 'That email and password do not match an account.',
  email_taken: 'That email already has an account.',
  weak_password: 'Use at least 8 characters.',
  network: 'Could not reach Maidan. Check your connection and try again.',
};

export default function SignInScreen() {
  const router = useRouter();
  const { signIn, status } = useAuth();

  // Signing in only proves who you are. A player returning on a new device still has no
  // sports and no city stored, so the session lands in `needs_setup` and the root guard
  // keeps them inside this group — with nothing to move them on. Carry them to setup.
  useEffect(() => {
    if (status === 'needs_setup') router.replace('/(auth)/select-sports');
  }, [status, router]);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const emailError = submitted && !isValidEmail(email) ? 'Enter a valid email address' : undefined;
  const passwordError =
    submitted && !isValidPassword(password) ? 'At least 8 characters' : undefined;

  const submit = async () => {
    setSubmitted(true);
    setFailure(null);
    if (!isValidEmail(email) || !isValidPassword(password)) return;

    setBusy(true);
    const error = await signIn(email, password);
    setBusy(false);
    // The root layout's guard swaps the stack once the status flips; nothing to navigate.
    //
    // A dropped connection gets its own message. Telling someone on a bad signal that their
    // password is wrong sends them off to reset a password that was never the problem — and
    // on these networks that is the more likely of the two.
    if (error) setFailure(FAILURES[error]);
  };

  return (
    <Screen>
      {/* Sign-in is the root of the signed-out app: there is nothing above it to go back to. */}
      <AppBar title="Sign in" />

      <KeyboardAvoidingView
        style={styles.flex}
        // `padding` on both: leaving Android on `undefined` relies on the window resizing
        // under the keyboard, and SDK 54 draws edge-to-edge, so it no longer does.
        behavior="padding"
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Text variant="body" color={colors.textSecondary} style={styles.subtitle}>
            Give credentials to sign in to your account
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
            error={emailError}
            accessibilityLabel="Email"
            testID="email"
          />

          <View style={styles.fieldGap} />

          <TextField
            icon="lock"
            secure
            value={password}
            onChangeText={setPassword}
            placeholder="Type your password"
            autoCapitalize="none"
            autoComplete="current-password"
            textContentType="password"
            error={passwordError}
            accessibilityLabel="Password"
            testID="password"
          />

          <View style={styles.row}>
            <Toggle
              value={remember}
              onValueChange={setRemember}
              accessibilityLabel="Remember me"
              testID="remember"
            />
            <Text variant="body" style={styles.rememberLabel}>
              Remember Me
            </Text>
            <Link href="/(auth)/reset-password" asChild>
              <PressableScale accessibilityLabel="Forgot password">
                <Text variant="body" color={colors.orangeInk}>
                  Forgot Password?
                </Text>
              </PressableScale>
            </Link>
          </View>

          {failure ? (
            <Text variant="meta" color={colors.danger} style={styles.failure}>
              {failure}
            </Text>
          ) : null}

          <Button
            label="Sign in"
            onPress={submit}
            loading={busy}
            style={styles.cta}
            testID="sign-in"
          />

          <View style={styles.social}>
            {/*
              Google sign-in needs a real OAuth exchange — a Google client id, a token sent
              to the server, and an account matched or created against it. Until that
              exists the button cannot produce a session the server would accept, and
              `SocialRow` drops a provider with nothing behind it rather than showing one
              that signs someone into a state where every request is refused.
            */}
            <SocialRow providers={[{ name: 'google', label: 'Continue with Google' }]} />
          </View>

          <View style={styles.footer}>
            <Text variant="bodySmall" color={colors.textSecondary}>
              Don&apos;t have an account?{' '}
            </Text>
            <Link href="/(auth)/sign-up" asChild>
              <PressableScale accessibilityLabel="Create an account">
                <Text variant="bodySmall" color={colors.orangeInk}>
                  Sign Up
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
  // Frame: subtitle at y126, first field at y168.
  subtitle: { marginTop: s(31), marginBottom: s(28) },
  fieldGap: { height: s(16) },
  // Frame: the row sits at y302, 22 below the second field.
  row: { flexDirection: 'row', alignItems: 'center', marginTop: s(22) },
  rememberLabel: { flex: 1, marginLeft: spacing.md },
  failure: { marginTop: spacing.md },
  // Frame: CTA at y382, 61 below the row.
  cta: { marginTop: s(61) },
  // Frame: the divider sits at y554, 114 below the CTA.
  social: { marginTop: s(56) },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: s(64),
  },
});
