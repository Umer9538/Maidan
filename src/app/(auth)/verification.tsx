/**
 * Verification — frame `08_Verification`.
 *
 * Measured from the export: title y74, subtitle y126, the number on its own line at y152,
 * four 55pt boxes at y198 spanning 304 centred, CTA y298 at 327x58, resend line at y386.
 */
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppBar, Button, OtpInput, PressableScale, Screen, Text } from '@/components/ui';
import { useAuth } from '@/features/auth/context';
import { formatCountdown } from '@/lib/datetime';
import { useGoBack } from '@/lib/navigation';
import { colors, spacing } from '@/theme';

const RESEND_SECONDS = 60;

export default function VerificationScreen() {
  const router = useRouter();
  const goBack = useGoBack('/(auth)/sign-in');
  const { pendingPhone, verify } = useAuth();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(RESEND_SECONDS);

  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsLeft((current) => (current <= 0 ? 0 : current - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const submit = async () => {
    setBusy(true);
    setError(null);
    const ok = await verify(code);
    setBusy(false);
    if (!ok) {
      setError('That code did not match. Check the SMS and try again.');
      return;
    }
    router.replace('/(auth)/select-sports');
  };

  return (
    <Screen>
      <AppBar title="Verification" onBack={goBack} />

      <View style={styles.body}>
        <Text variant="body" color={colors.textSecondary}>
          We&apos;ve sent you a verification code on
        </Text>
        <Text variant="cardTitle" style={styles.phone}>
          {pendingPhone ?? ''}
        </Text>

        <OtpInput value={code} onChangeText={setCode} testID="otp" />

        {error ? (
          <Text variant="meta" color={colors.danger} align="center" style={styles.error}>
            {error}
          </Text>
        ) : null}

        <Button
          label="Continue"
          onPress={submit}
          disabled={code.length < 4}
          loading={busy}
          style={styles.cta}
          testID="verify"
        />

        <View style={styles.resend}>
          {secondsLeft > 0 ? (
            <Text variant="bodySmall" color={colors.textSecondary}>
              Re-send code in{' '}
              <Text variant="bodySmall" color={colors.orangeInk}>
                {formatCountdown(secondsLeft)}
              </Text>
            </Text>
          ) : (
            <PressableScale
              onPress={() => setSecondsLeft(RESEND_SECONDS)}
              accessibilityLabel="Re-send verification code"
            >
              <Text variant="bodySmall" color={colors.orangeInk}>
                Re-send code
              </Text>
            </PressableScale>
          )}
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: spacing.gutter },
  phone: { marginTop: spacing.md, marginBottom: 34 },
  error: { marginTop: spacing.md },
  cta: { marginTop: 45 },
  resend: { alignItems: 'center', marginTop: spacing.gutter },
});
