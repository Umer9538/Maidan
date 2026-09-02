/**
 * Closed dates.
 *
 * A ground closes for Eid, resurfaces a pitch, or gives the whole place over to a
 * tournament for a weekend. Before this the only way to stop those hours selling was to
 * unpublish the venue, which also pulled it from search and shut every other court.
 *
 * A closure covers one court or the whole ground, and it is a real rule rather than a
 * display one: the hours stop being bookable in the app *and* at the owner's own counter.
 *
 * Bookings already taken inside the window are counted and reported, never cancelled.
 * Cancelling would refund and notify people as a side effect of tapping a date; what to do
 * about games already booked is a decision, and it stays the owner's.
 */
import { useLocalSearchParams } from 'expo-router';
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
} from '@/components/ui';
import { useAddBlackout, useBlackouts, useCourts, useMyVenues, useRemoveBlackout } from '@/data/queries';
import { formatSlotShort } from '@/lib/datetime';
import { useGoBack } from '@/lib/navigation';
import { colors, radius, s, shadow, spacing } from '@/theme';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * A calendar day in PKT, as the instants either end of it.
 *
 * PKT is UTC+05:00 with no DST, so subtracting five hours from midnight is exact — and it
 * stays exact on Hermes, where `Intl` time zones are not dependable across both platforms.
 */
function pktDayRange(from: string, to: string) {
  const [fy, fm, fd] = from.split('-').map(Number);
  const [ty, tm, td] = to.split('-').map(Number);
  return {
    startsAt: new Date(Date.UTC(fy, fm - 1, fd, -5, 0, 0)).toISOString(),
    // Exclusive end: the day *after* the last closed one, so a single-day closure covers
    // that whole day rather than collapsing to nothing.
    endsAt: new Date(Date.UTC(ty, tm - 1, td + 1, -5, 0, 0)).toISOString(),
  };
}

export default function BlackoutsScreen() {
  const { venueId } = useLocalSearchParams<{ venueId: string }>();
  const goBack = useGoBack('/owner/venues');

  const venues = useMyVenues();
  const courts = useCourts(venueId ?? '');
  const blackouts = useBlackouts(venueId ?? '');
  const add = useAddBlackout();
  const remove = useRemoveBlackout();

  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [scope, setScope] = useState<string>('all');
  const [reason, setReason] = useState('');
  const [submitted, setSubmitted] = useState(false);

  if (!venueId) return <NotFound title="Closed dates" record="ground" onBack={goBack} />;

  const venue = (venues.data ?? []).find((candidate) => candidate.id === venueId);
  const list = blackouts.data ?? [];
  const courtList = courts.data ?? [];

  const fromError = submitted && !DATE.test(from) ? 'Use a date like 2026-09-20' : undefined;
  const toError = submitted && !DATE.test(to) ? 'Use a date like 2026-09-20' : undefined;
  const orderError =
    submitted && DATE.test(from) && DATE.test(to) && to < from
      ? 'The last day cannot be before the first'
      : undefined;

  const submit = () => {
    setSubmitted(true);
    if (!DATE.test(from) || !DATE.test(to) || to < from) return;

    add.mutate(
      {
        venueId,
        blackout: {
          ...pktDayRange(from, to),
          courtId: scope === 'all' ? undefined : scope,
          reason: reason.trim(),
        },
      },
      {
        onSuccess: (created) => {
          setFrom('');
          setTo('');
          setReason('');
          setSubmitted(false);

          // Said out loud rather than silently swallowed. The owner has to know these games
          // are still on their sheet, because the people in them are still coming.
          if (created.existingBookings > 0) {
            Alert.alert(
              'Closed, but check your sheet',
              `${created.existingBookings} booking${created.existingBookings === 1 ? '' : 's'} ` +
                'already fall inside those dates. Nothing new can be booked, but those games ' +
                'still stand — cancel them yourself if the ground really is shut.',
            );
          }
        },
        onError: (error) => Alert.alert('Could not close those dates', (error as Error).message),
      },
    );
  };

  return (
    <Screen>
      <AppBar title="Closed dates" onBack={goBack} />

      <KeyboardAvoidingView style={styles.flex} behavior="padding">
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Text variant="body" color={colors.textSecondary}>
            Close hours without taking {venue?.name ?? 'the ground'} off the board. Nothing can
            be booked in them — in the app or at your counter.
          </Text>

          {list.map((blackout) => {
            const court = courtList.find((candidate) => candidate.id === blackout.courtId);
            return (
              <View key={blackout.id} style={styles.row} testID={`blackout-${blackout.id}`}>
                <View style={styles.rowText}>
                  <Text variant="cardTitle">
                    {formatSlotShort(blackout.startsAt).split(',')[0]} –{' '}
                    {formatSlotShort(blackout.endsAt).split(',')[0]}
                  </Text>
                  <Text variant="meta" color={colors.textSecondary}>
                    {court ? court.name : 'Whole ground'}
                    {blackout.reason ? ` · ${blackout.reason}` : ''}
                  </Text>
                </View>
                <PressableScale
                  onPress={() => remove.mutate(blackout.id)}
                  accessibilityLabel="Reopen these dates"
                  testID={`reopen-${blackout.id}`}
                >
                  <Text variant="metaStrong" color={colors.orangeInk}>
                    Reopen
                  </Text>
                </PressableScale>
              </View>
            );
          })}

          {list.length === 0 && !blackouts.isPending ? (
            <Text variant="meta" color={colors.textSecondary}>
              Nothing closed. The ground is open whenever its hours say it is.
            </Text>
          ) : null}

          <Divider />

          <Text variant="cardTitle">Close some dates</Text>

          <View style={styles.dates}>
            <View style={styles.half}>
              <TextField
                icon="calendar"
                value={from}
                onChangeText={setFrom}
                placeholder="2026-09-20"
                keyboardType="numbers-and-punctuation"
                error={fromError}
                accessibilityLabel="First day closed"
                testID="from"
              />
            </View>
            <View style={styles.half}>
              <TextField
                icon="calendar"
                value={to}
                onChangeText={setTo}
                placeholder="2026-09-22"
                keyboardType="numbers-and-punctuation"
                error={toError ?? orderError}
                accessibilityLabel="Last day closed"
                testID="to"
              />
            </View>
          </View>
          <Text variant="meta" color={colors.textSecondary}>
            Both days included. For one day, put the same date twice.
          </Text>

          <Text variant="cardTitle" style={styles.label}>
            What is closed
          </Text>
          <PillGroup
            options={[
              { value: 'all', label: 'Whole ground' },
              ...courtList.map((court) => ({ value: court.id, label: court.name })),
            ]}
            value={scope}
            onChange={setScope}
            testID="scope"
          />

          <TextField
            value={reason}
            onChangeText={setReason}
            placeholder="Eid, resurfacing, tournament…"
            accessibilityLabel="Reason"
            testID="reason"
          />
          <Text variant="meta" color={colors.textSecondary}>
            For your own records. Players only see that the hour is unavailable.
          </Text>

          <Button
            label="Close these dates"
            onPress={submit}
            loading={add.isPending}
            style={styles.cta}
            testID="submit-blackout"
          />

          <View style={styles.notice}>
            <Icon name="clock" size={s(16)} color={colors.orangeDeep} bold />
            <Text variant="meta" color={colors.orangeDeep} style={styles.noticeText}>
              Bookings already taken inside a closure are not cancelled. We will tell you how
              many there are so you can deal with them yourself.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { paddingHorizontal: spacing.gutter, paddingBottom: spacing.xxl, gap: spacing.md },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radius.card,
    padding: spacing.md,
    ...shadow.card,
  },
  rowText: { flex: 1, gap: 2 },
  dates: { flexDirection: 'row', gap: spacing.sm },
  half: { flex: 1 },
  label: { marginTop: spacing.sm },
  cta: { marginTop: spacing.sm },
  notice: {
    flexDirection: 'row',
    gap: spacing.sm,
    backgroundColor: colors.orangeWashSolid,
    borderRadius: radius.thumb,
    padding: spacing.md,
  },
  noticeText: { flex: 1, lineHeight: s(18) },
});
