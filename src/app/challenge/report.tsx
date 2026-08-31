/**
 * Report a score — Pillar 3 (docs/04). No Figma frame exists; docs/07 §6 describes the
 * shape: "Score entry is two large number fields; the copy states plainly that the
 * leaderboard only moves when both captains agree."
 *
 * That sentence is the screen's whole job. A captain reporting alone changes nothing, and
 * saying so up front is what stops the other captain's silence reading as a bug — so the
 * state after submitting is "waiting on them", not "done".
 */
import { useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/icons';
import { AppBar, Button, EmptyState, NotFound, Screen, Stepper, Text, Thumb } from '@/components/ui';
import { ApiError } from '@/data/api';
import { useChallenge, useReportScore, useTeams } from '@/data/queries';
import { CURRENT_USER_ID } from '@/data/seed';
import { FORMAT_LABELS, STAKE_LABELS } from '@/domain/labels';
import { formatSlotShort } from '@/lib/datetime';
import { useGoBack } from '@/lib/navigation';
import { colors, radius, s, spacing } from '@/theme';

type Outcome = 'idle' | 'waiting' | 'settled' | 'disputed';

export default function ReportScoreScreen() {
  const { challengeId } = useLocalSearchParams<{ challengeId: string }>();
  const goBack = useGoBack('/(tabs)/challenges');

  const challenge = useChallenge(challengeId);
  const teams = useTeams();
  const report = useReportScore();

  const [challengerScore, setChallengerScore] = useState(0);
  const [opponentScore, setOpponentScore] = useState(0);
  const [outcome, setOutcome] = useState<Outcome>('idle');
  const [failure, setFailure] = useState<string | null>(null);

  const challenger = (teams.data ?? []).find(
    (team) => team.id === challenge.data?.challengerTeamId,
  );
  const opponent = (teams.data ?? []).find((team) => team.id === challenge.data?.opponentTeamId);

  /** The team reporting is whichever side the current player captains or plays for. */
  const myTeam = useMemo(() => {
    const mine = (teams.data ?? []).filter((team) => team.memberIds.includes(CURRENT_USER_ID));
    return (
      mine.find((team) => team.id === challenger?.id) ??
      mine.find((team) => team.id === opponent?.id) ??
      null
    );
  }, [teams.data, challenger, opponent]);

  const alreadyReported = Boolean(myTeam && challenge.data?.reportedScores[myTeam.id]);

  const submit = () => {
    if (!myTeam) return;
    setFailure(null);
    report.mutate(
      { challengeId, teamId: myTeam.id, challengerScore, opponentScore },
      {
        onSuccess: (result) => {
          setOutcome(result.settled ? 'settled' : result.disputed ? 'disputed' : 'waiting');
        },
        onError: (error) => {
          if (error instanceof ApiError && error.code === 'not_a_captain') {
            setFailure('Only the two teams playing can report this score.');
            return;
          }
          setFailure('That did not send. Try again.');
        },
      },
    );
  };

  // Opened without an id — a stale link or a malformed deep link. The query behind this
  // screen is disabled without one, and a disabled query stays pending forever, so the
  // spinner below would never clear.
  if (!challengeId) return <NotFound title="Report result" record="challenge" onBack={goBack} />;

  if (challenge.isPending || teams.isPending) {
    return (
      <Screen>
        <ActivityIndicator style={styles.loader} color={colors.orange} />
      </Screen>
    );
  }

  if (!challenge.data || !challenger || !opponent) {
    return (
      <Screen>
        <AppBar title="Report score" onBack={goBack} />
        <EmptyState
          icon="trophy"
          title="Nothing to report"
          body="This challenge has not been agreed with an opponent yet."
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <AppBar title="Report score" onBack={goBack} />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text variant="meta" color={colors.textSecondary} align="center" style={styles.meta}>
          {FORMAT_LABELS[challenge.data.format]} · {challenge.data.area} ·{' '}
          {formatSlotShort(challenge.data.proposedStartAt, { abbreviateWeekday: true })} ·{' '}
          {STAKE_LABELS[challenge.data.stake]}
        </Text>

        <View style={styles.versus}>
          <Side
            name={challenger.name}
            crestUrl={challenger.crestUrl}
            id={challenger.id}
            score={challengerScore}
            onChange={setChallengerScore}
            disabled={outcome !== 'idle' || alreadyReported}
            testID="score-challenger"
          />
          <Text variant="screenTitle" color={colors.orangeInk} style={styles.vs}>
            VS
          </Text>
          <Side
            name={opponent.name}
            crestUrl={opponent.crestUrl}
            id={opponent.id}
            score={opponentScore}
            onChange={setOpponentScore}
            disabled={outcome !== 'idle' || alreadyReported}
            testID="score-opponent"
          />
        </View>

        <Status outcome={outcome} alreadyReported={alreadyReported} />

        {failure ? (
          <Text variant="meta" color={colors.danger} align="center" style={styles.failure}>
            {failure}
          </Text>
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        {outcome === 'idle' && !alreadyReported ? (
          <Button
            label="Submit score"
            onPress={submit}
            loading={report.isPending}
            disabled={!myTeam}
            testID="score-submit"
          />
        ) : (
          <Button label="Done" variant="secondary" onPress={goBack} testID="score-done" />
        )}
      </View>
    </Screen>
  );
}

function Side({
  name,
  crestUrl,
  id,
  score,
  onChange,
  disabled,
  testID,
}: {
  name: string;
  crestUrl: string | null;
  id: string;
  score: number;
  onChange: (value: number) => void;
  disabled: boolean;
  testID: string;
}) {
  return (
    <View style={styles.side}>
      <Thumb id={id} name={name} uri={crestUrl} dimension={s(64)} circular />
      <Text variant="cardTitle" align="center" numberOfLines={2} style={styles.sideName}>
        {name}
      </Text>
      {disabled ? (
        <Text variant="screenTitle" align="center" style={styles.lockedScore}>
          {score}
        </Text>
      ) : (
        <Stepper
          value={score}
          onChange={onChange}
          min={0}
          max={99}
          label={`${name} score`}
          testID={testID}
        />
      )}
    </View>
  );
}

function Status({ outcome, alreadyReported }: { outcome: Outcome; alreadyReported: boolean }) {
  if (outcome === 'idle' && !alreadyReported) {
    return (
      <View style={styles.notice}>
        <Icon name="shield" size={s(16)} color={colors.orange} bold />
        <Text variant="meta" color={colors.textSecondary} style={styles.noticeText}>
          Both captains report separately. The leaderboard only moves when the two scores match —
          yours alone changes nothing.
        </Text>
      </View>
    );
  }

  if (outcome === 'settled') {
    return (
      <View style={[styles.notice, styles.noticeGood]}>
        <Icon name="check-circle" size={s(18)} color={colors.orange} bold />
        <Text variant="bodySmall" style={styles.noticeText}>
          Both captains agree. The result is final and the leaderboard has moved.
        </Text>
      </View>
    );
  }

  if (outcome === 'disputed') {
    return (
      <View style={[styles.notice, styles.noticeBad]}>
        <Icon name="shield" size={s(18)} color={colors.danger} bold />
        <Text variant="bodySmall" style={styles.noticeText}>
          The two reports do not match, so nothing counts yet. Both are on record — talk to the
          other captain, or we will step in.
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.notice, styles.noticeGood]}>
      <Icon name="timer" size={s(18)} color={colors.orange} />
      <Text variant="bodySmall" style={styles.noticeText}>
        Reported. Waiting on the other captain — the result settles when their score matches yours.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  loader: { marginTop: s(48) },
  scroll: { paddingHorizontal: spacing.gutter, paddingBottom: spacing.xxl },
  meta: { marginTop: spacing.lg, marginBottom: s(30) },

  versus: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  side: { flex: 1, alignItems: 'center', gap: spacing.md },
  sideName: { minHeight: s(34) },
  lockedScore: { fontSize: s(32), lineHeight: s(40) },
  vs: { marginBottom: s(40) },

  notice: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: s(36),
    padding: spacing.lg,
    borderRadius: radius.card,
    backgroundColor: colors.card,
  },
  noticeGood: { backgroundColor: colors.orangeWash },
  noticeBad: { backgroundColor: 'rgba(211, 69, 59, 0.10)' },
  noticeText: { flex: 1, lineHeight: s(18) },
  failure: { marginTop: spacing.md },
  footer: { paddingHorizontal: spacing.gutter, paddingBottom: spacing.xxl, paddingTop: spacing.md },
});
