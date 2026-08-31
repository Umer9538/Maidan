/**
 * City leaderboard — the payoff Pillar 3 was missing (docs/04: "wins/losses build a team
 * record and city leaderboard per sport").
 *
 * Teams were carrying a W/L record and a rank that nothing ever displayed. The board is
 * per sport because a padel pair and a futsal side do not compete for the same position,
 * and per city because that is the unit of competition the product organises around.
 *
 * Rank is computed here rather than read from the stored `cityRank`: a stored rank goes
 * stale the moment any result settles, and a board showing two teams at #2 is worse than
 * no board.
 */
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, View } from 'react-native';

import {
  AppBar,
  EmptyState,
  PillGroup,
  PressableScale,
  Screen,
  Text,
  Thumb,
} from '@/components/ui';
import { useTeams } from '@/data/queries';
import { CURRENT_USER_ID } from '@/data/seed';
import { CITY_LABELS, SPORT_LABELS } from '@/domain/labels';
import type { Sport, Team } from '@/domain/types';
import { useGoBack } from '@/lib/navigation';
import { colors, radius, s, size, spacing } from '@/theme';

const SPORTS = (['padel', 'futsal', 'cricket'] as const).map((sport) => ({
  value: sport,
  label: SPORT_LABELS[sport],
}));

interface Ranked {
  team: Team;
  rank: number;
  played: number;
  winRate: number;
}

export default function LeaderboardScreen() {
  const router = useRouter();
  const goBack = useGoBack('/(tabs)/challenges');
  const [sport, setSport] = useState<Sport>('futsal');

  const teams = useTeams();

  const ranked = useMemo<Ranked[]>(() => {
    const inSport = (teams.data ?? []).filter((team) => team.sport === sport);

    return (
      inSport
        .map((team) => {
          const played = team.wins + team.losses;
          return { team, played, winRate: played === 0 ? 0 : team.wins / played, rank: 0 };
        })
        /*
         * Wins first, then win rate, then fewer losses. Sorting on win rate alone would put
         * a team that played once and won above one that won twelve of fifteen.
         */
        .sort(
          (a, b) =>
            b.team.wins - a.team.wins ||
            b.winRate - a.winRate ||
            a.team.losses - b.team.losses ||
            a.team.name.localeCompare(b.team.name),
        )
        .map((entry, index) => ({ ...entry, rank: index + 1 }))
    );
  }, [teams.data, sport]);

  const renderRow = ({ item }: { item: Ranked }) => {
    const mine = item.team.memberIds.includes(CURRENT_USER_ID);
    return (
      <PressableScale
        onPress={() => router.push(`/team/${item.team.id}`)}
        accessibilityLabel={`${item.rank}. ${item.team.name}, ${item.team.wins} won, ${item.team.losses} lost`}
        style={[styles.row, mine && styles.rowMine]}
        testID={`rank-${item.team.id}`}
      >
        <Text
          variant="cardTitle"
          color={item.rank <= 3 ? colors.orangeInk : colors.textSecondary}
          style={styles.rank}
        >
          {item.rank}
        </Text>
        <Thumb
          id={item.team.id}
          name={item.team.name}
          uri={item.team.crestUrl}
          dimension={size.actionCircle}
          circular
        />
        <View style={styles.rowText}>
          <Text variant="rowTitle" numberOfLines={1}>
            {item.team.name}
            {mine ? ' · your team' : ''}
          </Text>
          <Text variant="meta" color={colors.textSecondary}>
            {item.played === 0
              ? 'No matches played yet'
              : `${item.team.wins}W ${item.team.losses}L · ${Math.round(item.winRate * 100)}%`}
          </Text>
        </View>
      </PressableScale>
    );
  };

  return (
    <Screen>
      <AppBar title={`${CITY_LABELS.lahore} leaderboard`} onBack={goBack} />

      <View style={styles.filters}>
        <PillGroup options={SPORTS} value={sport} onChange={setSport} testID="leaderboard-sport" />
      </View>

      {teams.isPending ? (
        <ActivityIndicator style={styles.loader} color={colors.orange} />
      ) : (
        <FlatList
          data={ranked}
          keyExtractor={(entry) => entry.team.id}
          renderItem={renderRow}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <EmptyState
              icon="trophy"
              title={`No ${SPORT_LABELS[sport].toLowerCase()} teams yet`}
              body="Create a team and win a challenge to get on the board."
              actionLabel="Create a team"
              onAction={() => router.push('/team/create')}
            />
          }
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  filters: { paddingHorizontal: spacing.gutter, paddingBottom: spacing.lg },
  list: { paddingHorizontal: spacing.gutter, paddingBottom: spacing.xxl, flexGrow: 1, gap: s(10) },
  loader: { marginTop: s(48) },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.card,
    backgroundColor: colors.card,
  },
  rowMine: { backgroundColor: colors.orangeWash },
  rank: { width: s(26), textAlign: 'center' },
  rowText: { flex: 1, gap: s(3) },
});
