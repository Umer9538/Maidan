/**
 * The court form, shared by adding and editing.
 *
 * A court is one bookable space at one price, so the fields are few. The part worth care is
 * the evening rate: play in Pakistan peaks after dark and runs past midnight, so a rate
 * window whose end is *earlier* than its start is the ordinary case here, not a mistake.
 * The form says so rather than rejecting it.
 */
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Icon } from '@/components/icons';
import { Button, PillGroup, PressableScale, Text, TextField, Toggle } from '@/components/ui';
import type { CreateCourtInput } from '@/data/api';
import { FORMATS_BY_SPORT, FORMAT_LABELS, SPORT_LABELS } from '@/domain/labels';
import type { MatchFormat, PeakRule, Sport } from '@/domain/types';
import { formatWallClock } from '@/lib/datetime';
import { colors, radius, s, spacing } from '@/theme';

const SPORTS = (['padel', 'futsal', 'cricket'] as const).map((sport) => ({
  value: sport,
  label: SPORT_LABELS[sport],
}));

const CLOCK = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Evening play is what a peak rate is nearly always for, so that is what a new one opens at. */
const DEFAULT_RULE: PeakRule = { from: '18:00', to: '03:00', pricePerHour: 0, daysOfWeek: [] };

export interface CourtFormValues {
  name: string;
  sport: Sport;
  format: MatchFormat;
  indoor: boolean;
  price: string;
  peakRules: PeakRule[];
}

export function blankCourt(sport: Sport = 'padel'): CourtFormValues {
  return {
    name: '',
    sport,
    format: FORMATS_BY_SPORT[sport][0],
    indoor: true,
    price: '',
    peakRules: [],
  };
}

export interface CourtFormProps {
  /** Changing this resets the form — it is how the screen switches between courts. */
  initial: CourtFormValues;
  submitLabel: string;
  busy?: boolean;
  error?: string;
  onSubmit: (input: CreateCourtInput) => void;
  onCancel?: () => void;
}

export function CourtForm({
  initial,
  submitLabel,
  busy = false,
  error,
  onSubmit,
  onCancel,
}: CourtFormProps) {
  const [values, setValues] = useState(initial);
  const [submitted, setSubmitted] = useState(false);

  // Switching from adding to editing, or between two courts, has to reload the fields.
  useEffect(() => {
    setValues(initial);
    setSubmitted(false);
  }, [initial]);

  const set = <K extends keyof CourtFormValues>(key: K, value: CourtFormValues[K]) =>
    setValues((current) => ({ ...current, [key]: value }));

  const rupees = Number(values.price);
  const nameError = submitted && values.name.trim().length === 0 ? 'Give the court a name' : undefined;
  const priceError =
    submitted && (!Number.isInteger(rupees) || rupees <= 0)
      ? 'Enter the hourly rate in whole rupees'
      : undefined;

  const rulesValid = values.peakRules.every(
    (rule) => CLOCK.test(rule.from) && CLOCK.test(rule.to) && rule.pricePerHour > 0,
  );

  const chooseSport = (next: Sport) => {
    // The format has to belong to the sport, or a padel court is recorded as futsal 5v5 and
    // everything matchmaking does with it is wrong from the start.
    setValues((current) => ({ ...current, sport: next, format: FORMATS_BY_SPORT[next][0] }));
  };

  const editRule = (index: number, patch: Partial<PeakRule>) =>
    set(
      'peakRules',
      values.peakRules.map((rule, at) => (at === index ? { ...rule, ...patch } : rule)),
    );

  const submit = () => {
    setSubmitted(true);
    if (values.name.trim().length === 0) return;
    if (!Number.isInteger(rupees) || rupees <= 0) return;
    if (!rulesValid) return;

    onSubmit({
      name: values.name.trim(),
      sport: values.sport,
      format: values.format,
      indoor: values.indoor,
      basePricePerHour: rupees,
      peakRules: values.peakRules,
    });
  };

  return (
    <View style={styles.form}>
      <TextField
        value={values.name}
        onChangeText={(next) => set('name', next)}
        placeholder="Court 1"
        error={nameError}
        accessibilityLabel="Court name"
        testID="court-name"
      />

      <PillGroup options={SPORTS} value={values.sport} onChange={chooseSport} testID="court-sport" />

      <PillGroup
        options={FORMATS_BY_SPORT[values.sport].map((value) => ({
          value,
          label: FORMAT_LABELS[value],
        }))}
        value={values.format}
        onChange={(next) => set('format', next)}
        testID="court-format"
      />

      <TextField
        icon="wallet"
        value={values.price}
        onChangeText={(next) => set('price', next)}
        placeholder="3000"
        keyboardType="number-pad"
        prefix="Rs"
        error={priceError}
        accessibilityLabel="Price per hour"
        testID="court-price"
      />
      <Text variant="meta" color={colors.textSecondary}>
        The standard hourly rate, used whenever no evening rate applies.
      </Text>

      <View style={styles.toggleRow}>
        <Toggle
          value={values.indoor}
          onValueChange={(next) => set('indoor', next)}
          accessibilityLabel="Indoor"
        />
        <Text variant="body" style={styles.toggleLabel}>
          Indoor
        </Text>
      </View>

      <Text variant="cardTitle" style={styles.rulesTitle}>
        Evening rates
      </Text>
      <Text variant="meta" color={colors.textSecondary}>
        A higher rate for the hours people actually want. Ending earlier than it starts is
        normal — 6 PM to 3 AM covers the whole night.
      </Text>

      {values.peakRules.map((rule, index) => (
        <View key={index} style={styles.rule} testID={`rule-${index}`}>
          <View style={styles.ruleTimes}>
            <View style={styles.half}>
              <TextField
                icon="clock"
                value={rule.from}
                onChangeText={(next) => editRule(index, { from: next })}
                placeholder="18:00"
                keyboardType="numbers-and-punctuation"
                error={submitted && !CLOCK.test(rule.from) ? 'Use 18:00' : undefined}
                accessibilityLabel="Rate starts at"
                testID={`rule-from-${index}`}
              />
            </View>
            <View style={styles.half}>
              <TextField
                icon="clock"
                value={rule.to}
                onChangeText={(next) => editRule(index, { to: next })}
                placeholder="03:00"
                keyboardType="numbers-and-punctuation"
                error={submitted && !CLOCK.test(rule.to) ? 'Use 03:00' : undefined}
                accessibilityLabel="Rate ends at"
                testID={`rule-to-${index}`}
              />
            </View>
          </View>

          <View style={styles.ruleBottom}>
            <View style={styles.half}>
              <TextField
                icon="wallet"
                value={rule.pricePerHour > 0 ? String(rule.pricePerHour) : ''}
                onChangeText={(next) => editRule(index, { pricePerHour: Number(next) || 0 })}
                placeholder="4200"
                keyboardType="number-pad"
                prefix="Rs"
                error={submitted && rule.pricePerHour <= 0 ? 'Enter a rate' : undefined}
                accessibilityLabel="Evening rate"
                testID={`rule-price-${index}`}
              />
            </View>
            <PressableScale
              onPress={() =>
                set(
                  'peakRules',
                  values.peakRules.filter((_, at) => at !== index),
                )
              }
              accessibilityLabel="Remove this rate"
              style={styles.removeRule}
              testID={`rule-remove-${index}`}
            >
              <Text variant="metaStrong" color={colors.danger}>
                Remove
              </Text>
            </PressableScale>
          </View>

          {CLOCK.test(rule.from) && CLOCK.test(rule.to) ? (
            <Text variant="meta" color={colors.textSecondary}>
              {formatWallClock(rule.from)} – {formatWallClock(rule.to)}
              {rule.to < rule.from ? ', through midnight' : ''}
            </Text>
          ) : null}
        </View>
      ))}

      {values.peakRules.length < 6 ? (
        <PressableScale
          onPress={() => set('peakRules', [...values.peakRules, { ...DEFAULT_RULE }])}
          accessibilityLabel="Add an evening rate"
          style={styles.addRule}
          testID="add-rule"
        >
          <Icon name="plus" size={s(16)} color={colors.orangeInk} bold />
          <Text variant="metaStrong" color={colors.orangeInk}>
            Add an evening rate
          </Text>
        </PressableScale>
      ) : null}

      {error ? (
        <Text variant="meta" color={colors.danger}>
          {error}
        </Text>
      ) : null}

      <View style={styles.actions}>
        {onCancel ? (
          <Button label="Cancel" variant="soft" onPress={onCancel} style={styles.action} />
        ) : null}
        <Button
          label={submitLabel}
          variant={onCancel ? 'primary' : 'soft'}
          onPress={submit}
          loading={busy}
          style={styles.action}
          testID="submit-court"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.sm },
  toggleRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.xs },
  toggleLabel: { marginLeft: spacing.md },
  rulesTitle: { marginTop: spacing.md },
  rule: {
    gap: spacing.sm,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.thumb,
    padding: spacing.md,
  },
  ruleTimes: { flexDirection: 'row', gap: spacing.sm },
  ruleBottom: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  half: { flex: 1 },
  removeRule: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  addRule: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  action: { flex: 1 },
});
