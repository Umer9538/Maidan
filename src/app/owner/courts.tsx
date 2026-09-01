/**
 * Courts — how much space a ground actually has.
 *
 * The second half of onboarding, and the half that decides what players can book. A venue
 * with no courts cannot go live: it would sit in search as a ground with nothing on it.
 *
 * Each court is one bookable thing at one price, so three identical pitches are three rows
 * rather than a quantity field. That is what makes two people able to book "a pitch" at
 * 9 PM on a Friday without either of them being turned away at the gate.
 */
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, ScrollView, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/icons';
import {
  AppBar,
  Button,
  Divider,
  NotFound,
  PillGroup,
  PressableScale,
  Screen,
  Text,
  TextField,
  Toggle,
} from '@/components/ui';
import { useAddCourt, useCourts, useMyVenues, usePublishVenue, useRemoveCourt } from '@/data/queries';
import { FORMATS_BY_SPORT, FORMAT_LABELS, SPORT_LABELS } from '@/domain/labels';
import type { MatchFormat, Sport } from '@/domain/types';
import { formatPkrPerHour } from '@/lib/money';
import { useGoBack } from '@/lib/navigation';
import { colors, radius, s, shadow, spacing } from '@/theme';

const SPORTS = (['padel', 'futsal', 'cricket'] as const).map((sport) => ({
  value: sport,
  label: SPORT_LABELS[sport],
}));

export default function CourtsScreen() {
  const { venueId } = useLocalSearchParams<{ venueId: string }>();
  const router = useRouter();
  const goBack = useGoBack('/owner/venues');

  const venues = useMyVenues();
  const courts = useCourts(venueId ?? '');
  const add = useAddCourt();
  const remove = useRemoveCourt();
  const publish = usePublishVenue();

  const [name, setName] = useState('');
  const [sport, setSport] = useState<Sport>('padel');
  const [format, setFormat] = useState<MatchFormat>('padel_doubles');
  const [price, setPrice] = useState('');
  const [indoor, setIndoor] = useState(true);
  const [submitted, setSubmitted] = useState(false);

  // Opened without an id — a stale link. The court list is disabled without one, and a
  // disabled query never leaves `pending`, so the spinner would never clear.
  if (!venueId) return <NotFound title="Courts" record="ground" onBack={goBack} />;

  const venue = (venues.data ?? []).find((candidate) => candidate.id === venueId);
  const list = courts.data ?? [];
  const rupees = Number(price);

  const nameError = submitted && name.trim().length === 0 ? 'Give the court a name' : undefined;
  const priceError =
    submitted && (!Number.isInteger(rupees) || rupees <= 0)
      ? 'Enter the hourly rate in whole rupees'
      : undefined;

  const chooseSport = (next: Sport) => {
    setSport(next);
    // The format has to belong to the sport, or a padel court ends up recorded as futsal
    // 5v5 and the whole matchmaking side of it is wrong from the start.
    setFormat(FORMATS_BY_SPORT[next][0]);
  };

  const submit = () => {
    setSubmitted(true);
    if (name.trim().length === 0 || !Number.isInteger(rupees) || rupees <= 0) return;

    add.mutate(
      {
        venueId,
        court: {
          name: name.trim(),
          sport,
          format,
          indoor,
          basePricePerHour: rupees,
        },
      },
      {
        onSuccess: () => {
          setName('');
          setPrice('');
          setSubmitted(false);
        },
      },
    );
  };

  const confirmRemove = (courtId: string, courtName: string) =>
    Alert.alert(`Remove ${courtName}?`, 'It will no longer be bookable.', [
      { text: 'Keep it', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () =>
          remove.mutate(courtId, {
            onError: (error) => Alert.alert('Cannot remove', (error as Error).message),
          }),
      },
    ]);

  return (
    <Screen>
      <AppBar title={venue?.name ?? 'Courts'} onBack={goBack} />

      <KeyboardAvoidingView style={styles.flex} behavior="padding">
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Text variant="body" color={colors.textSecondary}>
            Add one court for each bookable space. Three identical pitches are three courts —
            that is what lets three groups book nine o&apos;clock at once.
          </Text>

          {list.map((court) => (
            <View key={court.id} style={styles.court} testID={`court-${court.id}`}>
              <View style={styles.courtText}>
                <Text variant="cardTitle">{court.name}</Text>
                <Text variant="meta" color={colors.textSecondary}>
                  {SPORT_LABELS[court.sport]} · {FORMAT_LABELS[court.format]} ·{' '}
                  {court.indoor ? 'Indoor' : 'Outdoor'}
                </Text>
              </View>
              <Text variant="metaStrong" color={colors.orangeInk}>
                {formatPkrPerHour(court.basePricePerHour)}
              </Text>
              <PressableScale
                onPress={() => confirmRemove(court.id, court.name)}
                accessibilityLabel={`Remove ${court.name}`}
                testID={`remove-${court.id}`}
              >
                <Icon name="more-vertical" size={s(18)} color={colors.textSecondary} />
              </PressableScale>
            </View>
          ))}

          <Divider />

          <Text variant="cardTitle" style={styles.addTitle}>
            Add a court
          </Text>

          <TextField
            value={name}
            onChangeText={setName}
            placeholder="Court 1"
            error={nameError}
            accessibilityLabel="Court name"
            testID="court-name"
          />

          <View style={styles.gap} />
          <PillGroup options={SPORTS} value={sport} onChange={chooseSport} testID="court-sport" />

          <View style={styles.gap} />
          <PillGroup
            options={FORMATS_BY_SPORT[sport].map((value) => ({
              value,
              label: FORMAT_LABELS[value],
            }))}
            value={format}
            onChange={setFormat}
            testID="court-format"
          />

          <View style={styles.gap} />
          <TextField
            icon="wallet"
            value={price}
            onChangeText={setPrice}
            placeholder="3000"
            keyboardType="number-pad"
            prefix="Rs"
            error={priceError}
            accessibilityLabel="Price per hour"
            testID="court-price"
          />
          <Text variant="meta" color={colors.textSecondary} style={styles.hint}>
            The standard hourly rate. Evening rates can be set later.
          </Text>

          <View style={styles.toggleRow}>
            <Toggle value={indoor} onValueChange={setIndoor} accessibilityLabel="Indoor" />
            <Text variant="body" style={styles.toggleLabel}>
              Indoor
            </Text>
          </View>

          {add.isError ? (
            <Text variant="meta" color={colors.danger}>
              {(add.error as Error).message}
            </Text>
          ) : null}

          <Button
            label="Add court"
            variant="soft"
            onPress={submit}
            loading={add.isPending}
            style={styles.addCta}
            testID="add-court"
          />

          {/*
            Only offered once the ground is approved and has something to book. Before that
            the button could only fail, and a control that always refuses is worse than one
            that is not there.
          */}
          {venue?.status === 'verified' && list.length > 0 ? (
            <Button
              label="Go live"
              onPress={() =>
                publish.mutate(venueId, { onSuccess: () => router.replace('/owner/venues') })
              }
              loading={publish.isPending}
              style={styles.publish}
              testID="publish"
            />
          ) : null}

          {venue?.status === 'pending' ? (
            <View style={styles.notice}>
              <Icon name="clock" size={s(16)} color={colors.orangeDeep} bold />
              <Text variant="meta" color={colors.orangeDeep} style={styles.noticeText}>
                Still in review. Add your courts now and you can go live the moment we
                approve the ground.
              </Text>
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { paddingHorizontal: spacing.gutter, paddingBottom: spacing.xxl, gap: spacing.md },
  court: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radius.card,
    padding: spacing.md,
    ...shadow.card,
  },
  courtText: { flex: 1, gap: 2 },
  addTitle: { marginTop: spacing.xs },
  gap: { height: spacing.xs },
  hint: { marginTop: -spacing.xs },
  toggleRow: { flexDirection: 'row', alignItems: 'center' },
  toggleLabel: { marginLeft: spacing.md },
  addCta: { marginTop: spacing.xs },
  publish: { marginTop: spacing.lg },
  notice: {
    flexDirection: 'row',
    gap: spacing.sm,
    backgroundColor: colors.orangeWashSolid,
    borderRadius: radius.thumb,
    padding: spacing.md,
  },
  noticeText: { flex: 1, lineHeight: s(18) },
});
