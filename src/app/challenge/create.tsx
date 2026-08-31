/**
 * Post a challenge — Pillar 3 (docs/04). No Figma frame exists for it; the kit has no
 * challenge screen at all, so this composes the design system's existing vocabulary
 * exactly as docs/07 §6 did for the challenge board.
 *
 * Two flows, one screen, as the PRD describes them:
 *   A. open   — posted to the board for any team to accept
 *   B. direct — aimed at one team, arriving as a decision for their captain
 *
 * The sport is the team's, never a choice: a futsal team cannot challenge anyone to
 * cricket, and offering the option would only let a captain post something unplayable.
 */
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/icons';
import { AppBar, Button, PillGroup, Screen, Text } from '@/components/ui';
import { useCreateChallenge, useTeams } from '@/data/queries';
import { CURRENT_USER_ID } from '@/data/seed';
import { FORMATS_BY_SPORT, FORMAT_LABELS, SPORT_LABELS, STAKE_LABELS } from '@/domain/labels';
import type { ChallengeStake, MatchFormat } from '@/domain/types';
import { chipParts, headingFor } from '@/lib/agenda';
import { formatClock } from '@/lib/datetime';
import { useGoBack } from '@/lib/navigation';
import { colors, radius, s, spacing } from '@/theme';

/** Lahore areas the seed actually covers (docs/06 §2 launches there). */
const AREAS = [
  'DHA Phase 5',
  'Gulberg III',
  'Johar Town',
  'Model Town',
  'Lahore Cantt',
  'Wapda Town',
];

const STAKES: { value: ChallengeStake; label: string }[] = [
  { value: 'split_cost', label: STAKE_LABELS.split_cost },
  { value: 'loser_pays', label: STAKE_LABELS.loser_pays },
];

/** Evening slots over the coming week — the hours this market actually plays. */
function slotOptions(): { value: string; label: string }[] {
  const now = new Date();
  const options: { value: string; label: string }[] = [];
  for (let day = 1; day <= 7; day += 1) {
    for (const hour of [19, 21, 23]) {
      const date = new Date(now);
      date.setUTCDate(date.getUTCDate() + day);
      date.setUTCHours(hour - 5, 0, 0, 0);
      const iso = date.toISOString();
      const chip = chipParts(iso);
      options.push({ value: iso, label: `${chip.day} ${chip.month} · ${formatClock(iso)}` });
    }
  }
  return options;
}

export default function CreateChallengeScreen() {
  const { teamId, opponentId } = useLocalSearchParams<{ teamId?: string; opponentId?: string }>();
  const router = useRouter();
  const goBack = useGoBack('/(tabs)/challenges');

  const teams = useTeams();
  const create = useCreateChallenge();

  const myTeams = useMemo(
    () => (teams.data ?? []).filter((team) => team.captainId === CURRENT_USER_ID),
    [teams.data],
  );
  const opponent = (teams.data ?? []).find((team) => team.id === opponentId) ?? null;

  // Challenging a specific team means fielding a team of the same sport.
  const eligible = opponent ? myTeams.filter((team) => team.sport === opponent.sport) : myTeams;
  const [fromTeamId, setFromTeamId] = useState<string | null>(teamId ?? null);
  const fromTeam = eligible.find((team) => team.id === fromTeamId) ?? eligible[0] ?? null;

  const formats = fromTeam ? FORMATS_BY_SPORT[fromTeam.sport] : [];
  const [format, setFormat] = useState<MatchFormat | null>(null);
  const [area, setArea] = useState<string>(AREAS[0]);
  const [slot, setSlot] = useState<string | null>(null);
  const [stake, setStake] = useState<ChallengeStake>('split_cost');
  const [failure, setFailure] = useState<string | null>(null);

  const slots = useMemo(() => slotOptions(), []);
  const activeFormat = format ?? formats[0] ?? null;
  const activeSlot = slot ?? slots[0]?.value ?? null;

  const submit = () => {
    if (!fromTeam || !activeFormat || !activeSlot) return;
    setFailure(null);
    create.mutate(
      {
        challengerTeamId: fromTeam.id,
        opponentTeamId: opponent?.id ?? null,
        format: activeFormat,
        area,
        proposedStartAt: activeSlot,
        stake,
      },
      {
        onSuccess: () => router.replace('/(tabs)/challenges'),
        onError: () => setFailure('We could not post that challenge. Try again.'),
      },
    );
  };

  if (teams.isPending) {
    return (
      <Screen>
        <ActivityIndicator style={styles.loader} color={colors.orange} />
      </Screen>
    );
  }

  if (!fromTeam) {
    return (
      <Screen>
        <AppBar title="Post a challenge" onBack={goBack} />
        <View style={styles.noTeam}>
          <Text variant="cardTitle" align="center">
            You need a team first
          </Text>
          <Text variant="bodySmall" color={colors.textSecondary} align="center">
            {opponent
              ? `Only a ${SPORT_LABELS[opponent.sport].toLowerCase()} team can challenge ${opponent.name}.`
              : 'Create a team and you can challenge anyone in Lahore.'}
          </Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <AppBar title={opponent ? 'Challenge a team' : 'Post a challenge'} onBack={goBack} />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.summary}>
          <Text variant="cardTitle">
            {fromTeam.name}
            {opponent ? ` vs ${opponent.name}` : ''}
          </Text>
          <Text variant="meta" color={colors.textSecondary}>
            {SPORT_LABELS[fromTeam.sport]} ·{' '}
            {opponent ? 'Direct challenge' : 'Open to any team that accepts'}
          </Text>
        </View>

        {eligible.length > 1 ? (
          <>
            <Label>Playing as</Label>
            <PillGroup
              options={eligible.map((team) => ({ value: team.id, label: team.name }))}
              value={fromTeam.id}
              onChange={(next) => {
                setFromTeamId(next);
                setFormat(null);
              }}
              testID="challenge-team"
            />
          </>
        ) : null}

        <Label>Format</Label>
        <PillGroup
          options={formats.map((each) => ({ value: each, label: FORMAT_LABELS[each] }))}
          value={activeFormat}
          onChange={setFormat}
          testID="challenge-format"
        />

        <Label>Area</Label>
        <PillGroup
          options={AREAS.map((each) => ({ value: each, label: each }))}
          value={area}
          onChange={setArea}
          testID="challenge-area"
        />

        <Label>When</Label>
        <PillGroup
          options={slots.slice(0, 9)}
          value={activeSlot}
          onChange={setSlot}
          testID="challenge-slot"
        />
        {activeSlot ? (
          <Text variant="meta" color={colors.textSecondary} style={styles.hint}>
            {headingFor(activeSlot)} at {formatClock(activeSlot)}
          </Text>
        ) : null}

        <Label>Who pays</Label>
        <PillGroup options={STAKES} value={stake} onChange={setStake} testID="challenge-stake" />

        <View style={styles.notice}>
          <Icon name="shield" size={s(16)} color={colors.orange} bold />
          <Text variant="meta" color={colors.textSecondary} style={styles.noticeText}>
            The stake is between the two teams. Maidan never holds a wager — it books the slot and
            splits the cost the way you agree here.
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
          label={opponent ? 'Send challenge' : 'Post to the board'}
          onPress={submit}
          disabled={!activeFormat || !activeSlot}
          loading={create.isPending}
          testID="challenge-submit"
        />
      </View>
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
  loader: { marginTop: s(48) },
  scroll: { paddingHorizontal: spacing.gutter, paddingBottom: spacing.xxl },
  noTeam: { padding: spacing.gutter, gap: spacing.md, marginTop: s(48) },
  summary: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    padding: spacing.lg,
    gap: s(6),
    marginTop: spacing.md,
  },
  label: { marginTop: spacing.gutter, marginBottom: spacing.md },
  hint: { marginTop: spacing.md },
  notice: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.gutter },
  noticeText: { flex: 1, lineHeight: s(16) },
  failure: { marginTop: spacing.md },
  footer: { paddingHorizontal: spacing.gutter, paddingBottom: spacing.xxl, paddingTop: spacing.md },
});
