/**
 * Create an open match — the screen documented in docs/07 §4, built from that spec rather
 * than from a frame: it lives on the `📱 MAIDAN App` Figma page, which is not in the file.
 *
 * Format options, a players-needed stepper showing how many are already committed, skill
 * level, who it is open to, and a per-player cost derived from the booking — all on the
 * design system's own furniture (pill groups, the 327x48 field, the 58pt CTA).
 *
 * Two decisions worth stating:
 *
 * 1. **No sport selector.** docs/07 §6 flags this: the sport is fixed by the court already
 *    booked, so offering a choice would let someone post a futsal match on a padel court.
 *    The format options adapt to the sport instead.
 * 2. **Gender preference is a first-class field**, not a setting buried elsewhere. It is a
 *    market requirement (docs/07 §4), and a host who cannot state it will not post.
 */
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { Icon } from '@/components/icons';
import { AppBar, Button, NotFound, PillGroup, Screen, Stepper, Text, Toggle } from '@/components/ui';
import { ApiError } from '@/data/api';
import { useBooking, useCourts, useCreateOpenMatch, useVenue } from '@/data/queries';
import {
  FORMATS_BY_SPORT,
  FORMAT_LABELS,
  GENDER_LABELS,
  SKILL_LABELS,
  SPORT_LABELS,
} from '@/domain/labels';
import type { GenderPreference, MatchFormat, SkillLevel } from '@/domain/types';
import { formatSlotShort } from '@/lib/datetime';
import { formatPkr, perPlayerShare } from '@/lib/money';
import { useGoBack } from '@/lib/navigation';
import { colors, radius, s, spacing, typography } from '@/theme';

/**
 * Squad size each format opens at — a total, both sides included.
 *
 * Cricket does not follow the racket or futsal pattern. Box arenas run 6 a side, and
 * tape-ball street games run 8 (docs/01 §3), so those are 12 and 16 rather than the 11-a-
 * side a full match would imply. Nets is not a match at all: nobody takes sides, people
 * share a lane, which is why it opens at 6 and the copy changes with it.
 */
const DEFAULT_PLAYERS: Record<MatchFormat, number> = {
  padel_singles: 2,
  padel_doubles: 4,
  futsal_5v5: 10,
  futsal_6v6: 12,
  futsal_7v7: 14,
  cricket_box: 12,
  cricket_tape_ball: 16,
  cricket_nets: 6,
};

/** Nets is practice, so it asks a different question from a match. */
function isPractice(format: MatchFormat): boolean {
  return format === 'cricket_nets';
}

const SKILLS = (['beginner', 'intermediate', 'advanced'] as const).map((level) => ({
  value: level,
  label: SKILL_LABELS[level],
}));

const GENDERS = (['anyone', 'men', 'women'] as const).map((value) => ({
  value,
  label: GENDER_LABELS[value],
}));

export default function CreateMatchScreen() {
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
  const router = useRouter();
  const goBack = useGoBack('/(tabs)/matches');

  const booking = useBooking(bookingId);
  const venue = useVenue(booking.data?.venueId ?? '');
  const courts = useCourts(booking.data?.venueId ?? '');
  const create = useCreateOpenMatch();

  const court = (courts.data ?? []).find((candidate) => candidate.id === booking.data?.courtId);
  const sport = court?.sport;
  const formats = sport ? FORMATS_BY_SPORT[sport] : [];

  const [format, setFormat] = useState<MatchFormat | null>(null);
  const [playersNeeded, setPlayersNeeded] = useState<number | null>(null);
  const [playersJoined, setPlayersJoined] = useState(1);
  const [skill, setSkill] = useState<SkillLevel>('intermediate');
  const [gender, setGender] = useState<GenderPreference>('anyone');
  const [note, setNote] = useState('');
  const [instantJoin, setInstantJoin] = useState(true);
  const [failure, setFailure] = useState<string | null>(null);

  // The court decides the sport, so the format defaults to that court's own format.
  const activeFormat = format ?? court?.format ?? formats[0] ?? null;
  const activeNeeded = playersNeeded ?? (activeFormat ? DEFAULT_PLAYERS[activeFormat] : 10);
  const practice = activeFormat ? isPractice(activeFormat) : false;

  const share = useMemo(
    () => (booking.data ? perPlayerShare(booking.data.total, activeNeeded) : 0),
    [booking.data, activeNeeded],
  );

  const submit = () => {
    if (!activeFormat) return;
    setFailure(null);
    create.mutate(
      {
        bookingId,
        format: activeFormat,
        playersNeeded: activeNeeded,
        playersJoined,
        skillLevel: skill,
        genderPreference: gender,
        note: note.trim() || null,
        instantJoin,
      },
      {
        onSuccess: () => router.replace('/(tabs)/matches'),
        onError: (error) => {
          if (error instanceof ApiError && error.code === 'already_open') {
            setFailure('This booking is already open to other players.');
            return;
          }
          setFailure('We could not open the match. Try again.');
        },
      },
    );
  };

  // Opened without an id — a stale link or a malformed deep link. The query behind this
  // screen is disabled without one, and a disabled query stays pending forever, so the
  // spinner below would never clear.
  if (!bookingId) return <NotFound title="Open this match" record="booking" onBack={goBack} />;

  if (booking.isPending || courts.isPending) {
    return (
      <Screen>
        <ActivityIndicator style={styles.loader} color={colors.orange} />
      </Screen>
    );
  }

  return (
    <Screen>
      <AppBar title="Open this match" onBack={goBack} />

      <KeyboardAvoidingView
        style={styles.flex}
        // `padding` on both: leaving Android on `undefined` relies on the window resizing
        // under the keyboard, and SDK 54 draws edge-to-edge, so it no longer does.
        behavior="padding"
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.summary}>
            <Text variant="cardTitle">{venue.data?.name ?? ''}</Text>
            <Text variant="meta" color={colors.textSecondary}>
              {court?.name ?? ''}
              {sport ? ` · ${SPORT_LABELS[sport]}` : ''}
              {booking.data ? ` · ${formatSlotShort(booking.data.startAt)}` : ''}
            </Text>
          </View>

          <Label>Format</Label>
          <PillGroup
            options={formats.map((each) => ({ value: each, label: FORMAT_LABELS[each] }))}
            value={activeFormat}
            onChange={(next) => {
              setFormat(next);
              // A new format implies a new squad size, so the stepper follows unless the
              // host has already set one deliberately.
              setPlayersNeeded(null);
            }}
            testID="create-format"
          />

          <Label>{practice ? 'How many can share the net?' : 'How many players in total?'}</Label>
          <Stepper
            value={activeNeeded}
            onChange={(next) => setPlayersNeeded(next)}
            min={Math.max(2, playersJoined)}
            max={30}
            label="players needed"
            testID="create-needed"
          />

          <Label>{practice ? 'How many of you already?' : 'How many are already in?'}</Label>
          <Stepper
            value={playersJoined}
            onChange={(next) => setPlayersJoined(Math.min(next, activeNeeded))}
            min={1}
            max={activeNeeded}
            label="players already joined"
            testID="create-joined"
          />
          <Text variant="meta" color={colors.textSecondary} style={styles.hint}>
            {playersJoined} of {activeNeeded} joined · {Math.max(0, activeNeeded - playersJoined)}{' '}
            still needed
          </Text>

          <Label>Skill level</Label>
          <PillGroup options={SKILLS} value={skill} onChange={setSkill} testID="create-skill" />

          <Label>Open to</Label>
          <PillGroup options={GENDERS} value={gender} onChange={setGender} testID="create-gender" />

          <Label>Note (optional)</Label>
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder="Need a keeper. Regular Tuesday group."
            placeholderTextColor={colors.textSecondary}
            style={styles.note}
            multiline
            maxLength={140}
            accessibilityLabel="Note"
            testID="create-note"
          />

          <View style={styles.instantRow}>
            <View style={styles.instantText}>
              <Text variant="bodySmall">Let players join instantly</Text>
              <Text variant="meta" color={colors.textSecondary}>
                Off means you approve each request yourself.
              </Text>
            </View>
            <Toggle
              value={instantJoin}
              onValueChange={setInstantJoin}
              accessibilityLabel="Let players join instantly"
              testID="create-instant"
            />
          </View>

          <View style={styles.share}>
            <Icon name="wallet" size={s(18)} color={colors.orange} bold />
            <Text variant="bodySmall" style={styles.shareText}>
              Each player pays {formatPkr(share)}
            </Text>
            <Text variant="meta" color={colors.textSecondary}>
              {booking.data ? `${formatPkr(booking.data.total)} ÷ ${activeNeeded}` : ''}
            </Text>
          </View>

          {failure ? (
            <Text variant="meta" color={colors.danger} style={styles.failure}>
              {failure}
            </Text>
          ) : null}
        </ScrollView>

        <View style={styles.footer}>
          <Button
            label="Open the match"
            onPress={submit}
            disabled={!activeFormat}
            loading={create.isPending}
            testID="create-submit"
          />
        </View>
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
  loader: { marginTop: s(64) },
  scroll: { paddingHorizontal: spacing.gutter, paddingBottom: spacing.xxl },
  summary: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    padding: spacing.lg,
    gap: s(6),
    marginTop: spacing.md,
  },
  label: { marginTop: spacing.gutter, marginBottom: spacing.md },
  hint: { marginTop: spacing.md },
  note: {
    minHeight: s(80),
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: spacing.md,
    ...typography.bodySmall,
    lineHeight: undefined,
    color: colors.text,
    textAlignVertical: 'top',
  },
  instantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    marginTop: spacing.gutter,
  },
  instantText: { flex: 1, gap: s(3) },
  share: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.gutter,
    padding: spacing.lg,
    borderRadius: radius.card,
    backgroundColor: colors.orangeWash,
  },
  shareText: { flex: 1 },
  failure: { marginTop: spacing.md },
  footer: { paddingHorizontal: spacing.gutter, paddingBottom: spacing.xxl, paddingTop: spacing.md },
});
