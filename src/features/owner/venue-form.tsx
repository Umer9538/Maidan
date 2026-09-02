/**
 * The venue details form, shared by registering and editing.
 *
 * One component rather than two screens with the same fields: the validation, the clock
 * format and the wording about closing after midnight all have to agree, and the surest way
 * to make them agree is for there to be only one of each.
 *
 * The two callers differ only in what they start from and what the button says, so that is
 * all this takes.
 */
import { useState } from 'react';
import { KeyboardAvoidingView, ScrollView, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/icons';
import { Button, PillGroup, PressableScale, Text, TextField } from '@/components/ui';
import type { CreateVenueInput } from '@/data/api';
import { AMENITY_LABELS, CITY_LABELS } from '@/domain/labels';
import type { Amenity, City } from '@/domain/types';
import { colors, radius, s, spacing } from '@/theme';

/** Only Lahore is live. The others are shown so an owner elsewhere knows we are coming. */
const CITIES = (['lahore', 'karachi', 'islamabad'] as const).map((city) => ({
  value: city,
  label: CITY_LABELS[city],
  disabled: city !== 'lahore',
}));

const AMENITIES = Object.keys(AMENITY_LABELS) as Amenity[];

/** 24-hour wall clock. Closing may be earlier than opening — grounds here run past midnight. */
const CLOCK = /^([01]\d|2[0-3]):[0-5]\d$/;

export interface VenueFormValues {
  name: string;
  city: City;
  area: string;
  opensAt: string;
  closesAt: string;
  phone: string;
  about: string;
  amenities: Amenity[];
}

export const BLANK_VENUE: VenueFormValues = {
  name: '',
  city: 'lahore',
  area: '',
  opensAt: '09:00',
  closesAt: '03:00',
  phone: '',
  about: '',
  amenities: [],
};

export interface VenueFormProps {
  initial: VenueFormValues;
  submitLabel: string;
  busy?: boolean;
  error?: string;
  /** Shown above the fields — the review notice on registering, nothing when editing. */
  notice?: string;
  onSubmit: (values: VenueFormValues) => void;
}

export function VenueForm({
  initial,
  submitLabel,
  busy = false,
  error,
  notice,
  onSubmit,
}: VenueFormProps) {
  const [values, setValues] = useState(initial);
  const [submitted, setSubmitted] = useState(false);

  const set = <K extends keyof VenueFormValues>(key: K, value: VenueFormValues[K]) =>
    setValues((current) => ({ ...current, [key]: value }));

  const nameError = submitted && values.name.trim().length < 2 ? 'Enter the ground name' : undefined;
  const areaError = submitted && values.area.trim().length < 2 ? 'Enter the area' : undefined;
  const opensError =
    submitted && !CLOCK.test(values.opensAt) ? 'Use a 24-hour time, like 09:00' : undefined;
  const closesError =
    submitted && !CLOCK.test(values.closesAt) ? 'Use a 24-hour time, like 03:00' : undefined;

  const toggleAmenity = (amenity: Amenity) =>
    set(
      'amenities',
      values.amenities.includes(amenity)
        ? values.amenities.filter((item) => item !== amenity)
        : [...values.amenities, amenity],
    );

  const submit = () => {
    setSubmitted(true);
    if (values.name.trim().length < 2 || values.area.trim().length < 2) return;
    if (!CLOCK.test(values.opensAt) || !CLOCK.test(values.closesAt)) return;
    onSubmit(values);
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior="padding">
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {notice ? (
          <View style={styles.notice}>
            <Icon name="clock" size={s(16)} color={colors.orangeDeep} bold />
            <Text variant="meta" color={colors.orangeDeep} style={styles.noticeText}>
              {notice}
            </Text>
          </View>
        ) : null}

        <Label>Ground name</Label>
        <TextField
          icon="home"
          value={values.name}
          onChangeText={(next) => set('name', next)}
          placeholder="DHA Padel Club"
          error={nameError}
          accessibilityLabel="Ground name"
          testID="venue-name"
        />

        <Label>City</Label>
        <PillGroup
          options={CITIES}
          value={values.city}
          onChange={(next) => set('city', next)}
          testID="venue-city"
        />

        <Label>Area</Label>
        <TextField
          icon="location"
          value={values.area}
          onChangeText={(next) => set('area', next)}
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
              value={values.opensAt}
              onChangeText={(next) => set('opensAt', next)}
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
              value={values.closesAt}
              onChangeText={(next) => set('closesAt', next)}
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
          value={values.phone}
          onChangeText={(next) => set('phone', next)}
          placeholder="+92 42 35000111"
          keyboardType="phone-pad"
          accessibilityLabel="Counter number"
          testID="venue-phone"
        />

        <Label>Amenities</Label>
        <View style={styles.amenities}>
          {AMENITIES.map((amenity) => {
            const on = values.amenities.includes(amenity);
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
          value={values.about}
          onChangeText={(next) => set('about', next)}
          placeholder="Four panoramic padel courts, floodlit."
          multiline
          accessibilityLabel="About this ground"
          testID="venue-about"
        />

        {error ? (
          <Text variant="meta" color={colors.danger} style={styles.failure}>
            {error}
          </Text>
        ) : null}

        <Button
          label={submitLabel}
          onPress={submit}
          loading={busy}
          style={styles.cta}
          testID="submit-venue"
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/** What the form produces, in the shape the api takes. Coordinates are handled by callers. */
export function toVenueInput(values: VenueFormValues): Omit<CreateVenueInput, 'latitude' | 'longitude'> {
  return {
    name: values.name.trim(),
    city: values.city,
    area: values.area.trim(),
    opensAt: values.opensAt,
    closesAt: values.closesAt,
    phone: values.phone.trim(),
    about: values.about.trim(),
    amenities: values.amenities,
  };
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
