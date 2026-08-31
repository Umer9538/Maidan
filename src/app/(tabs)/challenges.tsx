/**
 * Team Challenges — Pillar 3, the thing no local competitor has. Ported from the
 * `Team Challenges` frame (node 1:1352).
 *
 * The frame's own cards collide: "Futsal 5v5 · W12 L3" is 93px wide from x78 and runs
 * past the separator dot at x154. `ListCard` truncates the meta line instead, and the
 * record is written `W12–L3` so it reads as one token when it does truncate.
 */
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, View } from 'react-native';

import { AppBar, EmptyState, ListCard, Screen, Segmented } from '@/components/ui';
import { useAcceptChallenge, useChallenges, useMyChallenges, useTeams } from '@/data/queries';
import { CURRENT_USER_ID } from '@/data/seed';
import { STAKE_LABELS, teamRecordLine } from '@/domain/labels';
import type { Challenge } from '@/domain/types';
import { formatSlotShort } from '@/lib/datetime';
import { colors, spacing } from '@/theme';

type Board = 'open' | 'ours';

export default function ChallengesScreen() {
  const router = useRouter();
  const [tab, setTab] = useState<Board>('open');

  const board = useChallenges();
  const mine = useMyChallenges();
  const teams = useTeams();
  const accept = useAcceptChallenge();

  const teamById = useMemo(
    () => new Map((teams.data ?? []).map((team) => [team.id, team])),
    [teams.data],
  );

  /**
   * Two different queries, not one list filtered twice.
   *
   * An accepted challenge leaves the open board, so filtering the board by "has an
   * opponent" could only ever return nothing — which is what it did.
   */
  const source = tab === 'open' ? board : mine;
  const visible =
    tab === 'open'
      ? (board.data ?? [])
      : (mine.data ?? []).filter((challenge) => challenge.opponentTeamId !== null);

  const myTeamIds = (teams.data ?? [])
    .filter((team) => team.memberIds.includes(CURRENT_USER_ID))
    .map((team) => team.id);

  const renderCard = (challenge: Challenge) => {
    /*
     * The board shows who is challenging. Our own matches show the *other* side — seeing
     * your own crest on a row telling you to report a score is useless.
     */
    const facingId =
      tab === 'open' || !myTeamIds.includes(challenge.challengerTeamId)
        ? challenge.challengerTeamId
        : (challenge.opponentTeamId ?? challenge.challengerTeamId);
    const team = teamById.get(facingId);
    if (!team) return null;

    return (
      <ListCard
        id={team.id}
        title={team.name}
        metaLeft={teamRecordLine(team, challenge)}
        metaRight={formatSlotShort(challenge.proposedStartAt, { abbreviateWeekday: true })}
        photoUri={team.crestUrl}
        // The right column is one control, and it takes its accessible name from `action`.
        // With the verb in the price slot the accept button announced itself as "Split
        // cost" — the stake, not what pressing it does. The verb has to be the control.
        price={STAKE_LABELS[challenge.stake]}
        action={tab === 'open' ? 'Accept' : reportLabel(challenge)}
        accessibilityHint={`Open ${team.name}`}
        onPress={() => router.push(`/team/${team.id}`)}
        onActionPress={
          tab === 'open'
            ? () => accept.mutate(challenge.id)
            : () =>
                router.push({
                  pathname: '/challenge/report',
                  params: { challengeId: challenge.id },
                })
        }
        testID={`challenge-${challenge.id}`}
      />
    );
  };

  return (
    <Screen>
      <AppBar
        title="Challenges"
        onBack={router.canGoBack() ? router.back : undefined}
        actions={[
          {
            icon: 'trophy',
            accessibilityLabel: 'City leaderboard',
            onPress: () => router.push('/leaderboard'),
          },
          {
            icon: 'users',
            accessibilityLabel: 'Create a team',
            onPress: () => router.push('/team/create'),
          },
        ]}
      />

      <View style={styles.filters}>
        <Segmented<Board>
          options={[
            { value: 'open', label: 'Open board' },
            { value: 'ours', label: 'Our matches' },
          ]}
          value={tab}
          onChange={setTab}
          testID="challenge-board-switch"
        />
      </View>

      {source.isPending || teams.isPending ? (
        <ActivityIndicator style={styles.loader} color={colors.orange} />
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(challenge) => challenge.id}
          renderItem={({ item }) => renderCard(item)}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={styles.gap} />}
          showsVerticalScrollIndicator={false}
          refreshing={source.isFetching}
          onRefresh={source.refetch}
          ListEmptyComponent={
            <EmptyState
              icon="trophy"
              title={tab === 'open' ? 'The board is clear' : 'No matches agreed yet'}
              body={
                tab === 'open'
                  ? 'No team has posted a challenge in your city yet. Post one and the board fills up fast.'
                  : 'Accept a challenge from the open board and it will show up here once both captains agree a slot.'
              }
              actionLabel={tab === 'open' ? 'Post a challenge' : undefined}
              onAction={tab === 'open' ? () => router.push('/challenge/create') : undefined}
            />
          }
        />
      )}
    </Screen>
  );
}

/** What the right column offers for a challenge we are already in. */
function reportLabel(challenge: Challenge): string {
  if (challenge.status === 'played') return 'Result';
  return Object.keys(challenge.reportedScores).length > 0 ? 'Reported' : 'Report';
}

const styles = StyleSheet.create({
  filters: { paddingHorizontal: spacing.gutter, paddingBottom: spacing.lg },
  list: { paddingHorizontal: spacing.gutter, paddingBottom: spacing.xxl },
  gap: { height: 14 },
  loader: { marginTop: 48 },
});
