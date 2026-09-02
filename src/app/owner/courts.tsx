/**
 * Courts — how much space a ground has, and what each space costs.
 *
 * A venue with no courts cannot go live: it would sit in search as a ground with nothing on
 * it. Each court is one bookable thing at one price, so three identical pitches are three
 * rows rather than a quantity field — that is what lets three groups book nine o'clock on a
 * Friday without any of them being turned away at the gate.
 *
 * Tapping a court edits it. Prices move, a pitch gets a roof, an evening rate turns out to
 * be too low; an owner who has to ask us to change their own rate stops bothering with the
 * app.
 */
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, ScrollView, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/icons';
import {
  AppBar,
  Button,
  Divider,
  NotFound,
  PressableScale,
  Screen,
  Text,
} from '@/components/ui';
import type { CreateCourtInput } from '@/data/api';
import {
  useAddCourt,
  useCourts,
  useMyVenues,
  usePublishVenue,
  useRemoveCourt,
  useUpdateCourt,
} from '@/data/queries';
import { FORMAT_LABELS, SPORT_LABELS } from '@/domain/labels';
import { blankCourt, CourtForm, type CourtFormValues } from '@/features/owner/court-form';
import { formatWallClock } from '@/lib/datetime';
import { formatPkrPerHour } from '@/lib/money';
import { useGoBack } from '@/lib/navigation';
import { colors, radius, s, shadow, spacing } from '@/theme';

export default function CourtsScreen() {
  const { venueId } = useLocalSearchParams<{ venueId: string }>();
  const router = useRouter();
  const goBack = useGoBack('/owner/venues');

  const venues = useMyVenues();
  const courts = useCourts(venueId ?? '');
  const add = useAddCourt();
  const update = useUpdateCourt();
  const remove = useRemoveCourt();
  const publish = usePublishVenue();

  /** The court being edited, or null when the form is adding a new one. */
  const [editingId, setEditingId] = useState<string | null>(null);

  const list = useMemo(() => courts.data ?? [], [courts.data]);
  const editing = list.find((court) => court.id === editingId) ?? null;

  /**
   * Rebuilt only when the target changes, because `CourtForm` reloads its fields whenever
   * this object does — a new one every render would wipe what the owner was typing.
   */
  const initial = useMemo<CourtFormValues>(
    () =>
      editing
        ? {
            name: editing.name,
            sport: editing.sport,
            format: editing.format,
            indoor: editing.indoor,
            price: String(editing.basePricePerHour),
            peakRules: editing.peakRules.map((rule) => ({ ...rule })),
          }
        : blankCourt(),
    [editing],
  );

  // Opened without an id — a stale link. The court list is disabled without one, and a
  // disabled query never leaves `pending`, so the spinner below would never clear.
  if (!venueId) return <NotFound title="Courts" record="ground" onBack={goBack} />;

  const venue = (venues.data ?? []).find((candidate) => candidate.id === venueId);

  const save = (input: CreateCourtInput) => {
    if (editingId) {
      update.mutate({ courtId: editingId, patch: input }, { onSuccess: () => setEditingId(null) });
    } else {
      add.mutate({ venueId, court: input });
    }
  };

  const confirmRemove = (courtId: string, courtName: string) =>
    Alert.alert(`Remove ${courtName}?`, 'It will no longer be bookable.', [
      { text: 'Keep it', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () =>
          remove.mutate(courtId, {
            onSuccess: () => setEditingId((current) => (current === courtId ? null : current)),
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

          {list.map((court) => {
            const open = court.id === editingId;
            return (
              <View key={court.id} style={[styles.court, open && styles.courtOpen]}>
                <PressableScale
                  onPress={() => setEditingId(open ? null : court.id)}
                  accessibilityLabel={`Edit ${court.name}`}
                  accessibilityState={{ expanded: open }}
                  style={styles.courtHead}
                  testID={`court-${court.id}`}
                >
                  <View style={styles.courtText}>
                    <Text variant="cardTitle">{court.name}</Text>
                    <Text variant="meta" color={colors.textSecondary}>
                      {SPORT_LABELS[court.sport]} · {FORMAT_LABELS[court.format]} ·{' '}
                      {court.indoor ? 'Indoor' : 'Outdoor'}
                    </Text>
                    {/* The evening rate is what an owner comes here to check. */}
                    {court.peakRules.map((rule, index) => (
                      <Text key={index} variant="meta" color={colors.orangeInk}>
                        {formatWallClock(rule.from)} – {formatWallClock(rule.to)} ·{' '}
                        {formatPkrPerHour(rule.pricePerHour)}
                      </Text>
                    ))}
                  </View>

                  <View style={styles.courtRight}>
                    <Text variant="metaStrong" color={colors.orangeInk}>
                      {formatPkrPerHour(court.basePricePerHour)}
                    </Text>
                    <Icon
                      name={open ? 'arrow-left' : 'chevron-right'}
                      size={s(16)}
                      color={colors.textSecondary}
                    />
                  </View>
                </PressableScale>

                {open ? (
                  <>
                    <Divider />
                    <CourtForm
                      initial={initial}
                      submitLabel="Save changes"
                      busy={update.isPending}
                      error={update.isError ? (update.error as Error).message : undefined}
                      onSubmit={save}
                      onCancel={() => setEditingId(null)}
                    />
                    <PressableScale
                      onPress={() => confirmRemove(court.id, court.name)}
                      accessibilityLabel={`Remove ${court.name}`}
                      style={styles.remove}
                      testID={`remove-${court.id}`}
                    >
                      <Text variant="metaStrong" color={colors.danger}>
                        Remove this court
                      </Text>
                    </PressableScale>
                  </>
                ) : null}
              </View>
            );
          })}

          {/* The add form is hidden while editing, so there is only ever one form on screen. */}
          {editingId === null ? (
            <>
              <Divider />
              <Text variant="cardTitle">Add a court</Text>
              <CourtForm
                initial={initial}
                submitLabel="Add court"
                busy={add.isPending}
                error={add.isError ? (add.error as Error).message : undefined}
                onSubmit={save}
              />
            </>
          ) : null}

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
    backgroundColor: colors.card,
    borderRadius: radius.card,
    padding: spacing.md,
    gap: spacing.sm,
    ...shadow.card,
  },
  courtOpen: { backgroundColor: colors.surfaceRaised },
  courtHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  courtText: { flex: 1, gap: 2 },
  courtRight: { alignItems: 'flex-end', gap: s(6) },
  remove: { alignItems: 'center', paddingVertical: spacing.md },
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
