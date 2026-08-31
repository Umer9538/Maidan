/**
 * Edit profile — frame `49_Edit Profile`.
 *
 * Measured from the flattened export: a 96pt avatar centred at y120, then four labelled
 * fields — a 10pt label inset to x36 with its 327x48 field 12 below it, on an 89pt pitch
 * (y255/277, y343/366, y432/455, y522/544) — and the save action at y722.
 *
 * The frame labels sit above the field rather than inside it as a placeholder. That is the
 * better pattern and worth keeping: a placeholder disappears the moment you type, so a
 * half-filled form stops saying what its fields are.
 */
import { useState } from 'react';
import { KeyboardAvoidingView, ScrollView, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/icons';
import { AppBar, Button, Screen, Text, TextField, Thumb } from '@/components/ui';
import { useAuth } from '@/features/auth/context';
import { isValidEmail, isValidPhone, normalisePhone } from '@/features/auth/validation';
import { useGoBack } from '@/lib/navigation';
import { colors, s, spacing } from '@/theme';

export default function EditProfileScreen() {
  const goBack = useGoBack('/(tabs)/profile');
  const { session, updateProfile } = useAuth();

  const [fullName, setFullName] = useState(session?.fullName ?? '');
  const [email, setEmail] = useState(session?.email ?? '');
  const [phone, setPhone] = useState(normalisePhone(session?.phone ?? ''));
  const [submitted, setSubmitted] = useState(false);

  const nameError = submitted && fullName.trim().length < 2 ? 'Enter your name' : undefined;
  const emailError = submitted && !isValidEmail(email) ? 'Enter a valid email address' : undefined;
  const phoneError =
    submitted && !isValidPhone(phone) ? 'Enter a 10-digit mobile number' : undefined;

  const save = () => {
    setSubmitted(true);
    if (fullName.trim().length < 2 || !isValidEmail(email) || !isValidPhone(phone)) return;

    updateProfile({
      fullName: fullName.trim(),
      email: email.trim(),
      phone: `+92${normalisePhone(phone)}`,
    });
    goBack();
  };

  return (
    <Screen>
      <AppBar title="Edit Profile" onBack={goBack} />

      <KeyboardAvoidingView
        style={styles.flex}
        // `padding` on both: leaving Android on `undefined` relies on the window resizing
        // under the keyboard, and SDK 54 draws edge-to-edge, so it no longer does.
        behavior="padding"
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.avatarWrap}>
            <Thumb
              id={session?.id ?? 'me'}
              name={session?.fullName ?? 'You'}
              uri={null}
              dimension={s(96)}
              circular
            />
            {/*
              No handler: choosing a photo needs the image picker, which is not wired.
              A camera badge that does nothing is worse than no badge.
            */}
            <View style={styles.avatarBadge}>
              <Icon name="profile" size={s(14)} color={colors.textOnOrange} bold />
            </View>
          </View>

          <Field label="Full name">
            <TextField
              value={fullName}
              onChangeText={setFullName}
              placeholder="Your name"
              autoCapitalize="words"
              autoComplete="name"
              error={nameError}
              accessibilityLabel="Full name"
              testID="edit-name"
            />
          </Field>

          <Field label="Email">
            <TextField
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              error={emailError}
              accessibilityLabel="Email"
              testID="edit-email"
            />
          </Field>

          <Field label="Mobile number">
            <TextField
              prefix="+92"
              value={phone}
              onChangeText={setPhone}
              placeholder="300 1234567"
              keyboardType="phone-pad"
              autoComplete="tel"
              maxLength={13}
              error={phoneError}
              accessibilityLabel="Mobile number"
              testID="edit-phone"
            />
          </Field>

          <Field label="City">
            {/*
              Read-only: the city drives which grounds and matches load, and changing it
              from here would silently re-point the whole app. It belongs in setup.
            */}
            <TextField
              value="Lahore"
              editable={false}
              accessibilityLabel="City, Lahore"
              onChangeText={() => {}}
            />
          </Field>
        </ScrollView>

        <View style={styles.footer}>
          <Button label="Save changes" onPress={save} testID="edit-save" />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.field}>
      <Text variant="meta" color={colors.textSecondary} style={styles.label}>
        {label}
      </Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { paddingHorizontal: spacing.gutter, paddingBottom: spacing.xxl },
  avatarWrap: { alignSelf: 'center', marginTop: s(29), marginBottom: s(39) },
  avatarBadge: {
    position: 'absolute',
    right: 0,
    bottom: s(4),
    width: s(30),
    height: s(30),
    borderRadius: s(15),
    backgroundColor: colors.orange,
    borderWidth: s(3),
    borderColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Frame: fields on an 89pt pitch — 48 tall, 12 under the label, 29 to the next label.
  field: { marginBottom: s(29) },
  label: { marginLeft: s(12), marginBottom: s(12) },
  footer: { paddingHorizontal: spacing.gutter, paddingBottom: spacing.xxl },
});
