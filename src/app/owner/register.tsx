/**
 * Register a ground.
 *
 * The first half of owner onboarding: who you are and where. Courts — how much space there
 * actually is — come next, on their own screen, because asking for both at once produces a
 * form nobody finishes on a phone.
 *
 * The form says plainly what happens after submitting. A listing goes into review and
 * nothing on it can be booked until MAIDAN approves it, and an owner who expects to be
 * trading the same evening will otherwise think the app is broken.
 */
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, ScrollView, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/icons';
import {
  AppBar,
  Button,
  PillGroup,
  PressableScale,
  Screen,
  Text,
  TextField,
} from '@/components/ui';
import { useCreateVenue } from '@/data/queries';
import { AMENITY_LABELS, CITY_LABELS } from '@/domain/labels';
import type { Amenity, City } from '@/domain/types';
import { useGoBack } from '@/lib/navigation';
import { colors, radius, s, spacing } from '@/theme';

/** Only Lahore is live; the others are shown so an owner elsewhere knows we are coming. */
const CITIES = (['lahore', 'karachi', 'islamabad'] as const).map((city) => ({
  value: city,
  label: CITY_LABELS[city],
  disabled: city !== 'lahore',
}));

const AMENITIES = Object.keys(AMENITY_LABELS) as Amenity[];

/** Lahore's centre. A rough pin the owner can correct is better than making them find one. */
const LAHORE = { latitude: 31.5204, longitude: 74.3587 };

const CLOCK = /^([01]\d|2[0-3]):[0-5]\d$/;

export default function RegisterVenueScreen() {
  const router = useRouter();
  const goBack = useGoBack('/owner/venues');
  const create = useCreateVenue();

  const [name, setName] = useState('');
  const [city, setCity] = useState<City>('lahore');
  const [area, setArea] = useState('');
  const [phone, setPhone] = useState('');
  const [opensAt, setOpensAt] = useState('09:00');
  const [closesAt, setClosesAt] = useState('03:00');
  const [about, setAbout] = useState('');
  const [amenities, setAmenities] = useState<Amenity[]>([]);
  const [submitted, setSubmitted] = useState(false);

  const nameError = submitted && name.trim().length < 2 ? 'Enter the ground name' : undefined;
  const areaError = submitted && area.trim().length < 2 ? 'Enter the area' : undefined;
  const opensError = submitted && !CLOCK.test(opensAt) ? 'Use a 24-hour time, like 09:00' : undefined;
  const closesError =
    submitted && !CLOCK.test(closesAt) ? 'Use a 24-hour time, like 03:00' : undefined;

  const toggleAmenity = (amenity: Amenity) =>
    setAmenities((current) =>
      current.includes(amenity)
        ? current.filter((item) => item !== amenity)
        : [...current, amenity],
    );

  const submit = () => {
    setSubmitted(true);
    if (name.trim().length < 2 || area.trim().length < 2) return;
    if (!CLOCK.test(opensAt) || !CLOCK.test(closesAt)) return;

    create.mutate(
      {
        name: name.trim(),
        city,
        area: area.trim(),
        ...LAHORE,
        opensAt,
        closesAt,
        phone: phone.trim(),
        about: about.trim(),
        amenities,
      },
      {
        // Straight on to courts. A ground with no courts cannot go live, so stopping here
        // would leave every new owner one step short without saying so.
        onSuccess: (venue) =>
          router.replace({ pathname: '/owner/courts', params: { venueId: venue.id } }),
      },
    );
  };

  return (
    <Screen>
      <AppBar title="Register a ground" onBack={goBack} />

      <KeyboardAvoidingView style={styles.flex} behavior="padding">
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.notice}>
            <Icon name="clock" size={s(16)} color={colors.orangeDeep} bold />
            <Text variant="meta" color={colors.orangeDeep} style={styles.noticeText}>
              We check every ground before it goes live. Nothing can be booked until then —
              usually a day or two.
            </Text>
          </View>

          <Label>Ground name</Label>
          <TextField
            icon="home"
            value={name}
            onChangeText={setName}
            placeholder="DHA Padel Club"
            error={nameError}
            accessibilityLabel="Ground name"
            testID="venue-name"
          />

          <Label>City</Label>
          <PillGroup options={CITIES} value={city} onChange={setCity} testID="venue-city" />

          <Label>Area</Label>
          <TextField
            icon="location"
            value={area}
            onChangeText={setArea}
            placeholder="DHA Phase 6"
            error={areaError}
            accessibilityLabel="Area"
            testID="venue-area"
          />

          <Label>Opening hours</Label>
          <View style={styles.row}>
            <View style={styles.half}>
              <TextField
                icon="clock"
                value={opensAt}
                onChangeText={setOpensAt}
                placeholder="09:00"
                keyboardType="numbers-and-punctuation"
                error={opensError}
                accessibilityLabel="Opens at"
                testID="venue-opens"
              />
            </View>
            <View style={styles.half}>
              <TextField
                icon="clock"
                value={closesAt}
                onChangeText={setClosesAt}
                placeholder="03:00"
                keyboardType="numbers-and-punctuation"
                error={closesError}
                accessibilityLabel="Closes at"
                testID="venue-closes"
              />
            </View>
          </View>
          <Text variant="meta" color={colors.textSecondary}>
            Closing after midnight is normal — 03:00 means three in the morning.
          </Text>

          <Label>Counter number</Label>
          <TextField
            icon="call"
            value={phone}
            onChangeText={setPhone}
            placeholder="+92 42 35000111"
            keyboardType="phone-pad"
            accessibilityLabel="Counter number"
            testID="venue-phone"
          />

          <Label>Amenities</Label>
          <View style={styles.amenities}>
            {AMENITIES.map((amenity) => {
              const on = amenities.includes(amenity);
              return (
                <PressableScale
                  key={amenity}
                  onPress={() => toggleAmenity(amenity)}
                  accessibilityLabel={AMENITY_LABELS[amenity]}
                  accessibilityState={{ selected: on }}
                  style={[styles.amenity, on && styles.amenityOn]}
                  testID={`amenity-${amenity}`}
                >
                  <Text variant="meta" color={on ? colors.orangeDeep : colors.textSecondary}>
                    {AMENITY_LABELS[amenity]}
                  </Text>
                </PressableScale>
              );
            })}
          </View>

          <Label>About</Label>
          <TextField
            value={about}
            onChangeText={setAbout}
            placeholder="Four panoramic padel courts, floodlit."
            multiline
            accessibilityLabel="About this ground"
            testID="venue-about"
          />

          {create.isError ? (
            <Text variant="meta" color={colors.danger} style={styles.failure}>
              {(create.error as Error).message}
            </Text>
          ) : null}

          <Button
            label="Send for review"
            onPress={submit}
            loading={create.isPending}
            style={styles.cta}
            testID="submit-venue"
          />
        </ScrollView>
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
  notice: {
    flexDirection: 'row',
    gap: spacing.sm,
    backgroundColor: colors.orangeWashSolid,
    borderRadius: radius.thumb,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  noticeText: { flex: 1, lineHeight: s(18) },
  label: { marginTop: spacing.lg, marginBottom: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.sm },
  half: { flex: 1 },
  amenities: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  amenity: {
    paddingHorizontal: s(14),
    paddingVertical: s(9),
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted,
  },
  amenityOn: { backgroundColor: colors.orangeWashSolid },
  failure: { marginTop: spacing.md },
  cta: { marginTop: spacing.xl },
});
