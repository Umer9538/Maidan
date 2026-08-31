/**
 * Team profile — the screen documented in docs/07 §4, built from that spec rather than a
 * frame: it lives on the `📱 MAIDAN App` Figma page, which is not in the file.
 *
 * "Orange banner with crest, W/L record, win rate, Lahore city rank, squad roster with
 * per-player reliability %."
 *
 * Reliability sits beside every name because it is the number that makes the anti-no-show
 * system work (docs/04 §4) — a captain picking a squad for a challenge is exactly who
 * needs to see it, and no local competitor surfaces it at all (docs/02 §5).
 */
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/icons';
import {
  AppBar,
  Button,
  Divider,
  EmptyState,
  PressableScale,
  Screen,
  Text,
  Thumb,
} from '@/components/ui';
import { useChallenges, usePlayers, useTeams } from '@/data/queries';
import { CURRENT_USER_ID } from '@/data/seed';
import { CITY_LABELS, FORMAT_LABELS, SPORT_LABELS, STAKE_LABELS } from '@/domain/labels';
import type { Player } from '@/domain/types';
import { formatSlotShort } from '@/lib/datetime';
import { useGoBack } from '@/lib/navigation';
import { colors, radius, s, size, spacing } from '@/theme';

export default function TeamProfileScreen() {
  const { teamId } = useLocalSearchParams<{ teamId: string }>();
  const router = useRouter();
  const goBack = useGoBack('/(tabs)/challenges');

  const teams = useTeams();
  const team = (teams.data ?? []).find((candidate) => candidate.id === teamId);
  const members = usePlayers(team?.memberIds ?? []);
  const challenges = useChallenges();

  const played = (team?.wins ?? 0) + (team?.losses ?? 0);
  const winRate = played === 0 ? null : Math.round(((team?.wins ?? 0) / played) * 100);
  const isCaptain = team?.captainId === CURRENT_USER_ID;

  const openChallenges = useMemo(
    () => (challenges.data ?? []).filter((challenge) => challenge.challengerTeamId === teamId),
    [challenges.data, teamId],
  );

  if (teams.isPending) {
    return (
      <Screen>
        <ActivityIndicator style={styles.loader} color={colors.orange} />
      </Screen>
    );
  }

  if (!team) {
    return (
      <Screen>
        <AppBar title="Team" onBack={goBack} />
        <EmptyState icon="trophy" title="Team not found" body="That team no longer exists." />
      </Screen>
    );
  }

  const renderMember = (player: Player) => (
    <View key={player.id} style={styles.member}>
      <Thumb
        id={player.id}
        name={player.name}
        uri={player.avatarUrl}
        dimension={size.chatAvatar}
        circular
      />
      <View style={styles.memberText}>
        <Text variant="rowTitle" numberOfLines={1}>
          {player.id === CURRENT_USER_ID ? `${player.name} (you)` : player.name}
          {player.id === team.captainId ? ' · Captain' : ''}
        </Text>
        <Text variant="meta" color={colors.textSecondary}>
          {player.gamesPlayed} games played
        </Text>
      </View>
      <View
        style={styles.reliability}
        accessible
        accessibilityLabel={`${player.reliability}% reliability`}
      >
        <Text
          variant="metaStrong"
          color={player.reliability >= 90 ? colors.orangeDeep : colors.textSecondary}
        >
          {player.reliability}%
        </Text>
        <Text variant="meta" color={colors.textSecondary}>
          reliable
        </Text>
      </View>
    </View>
  );

  return (
    <Screen edgeToEdge statusBarStyle="light" background={colors.orange}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {/* The banner is the brand orange, so everything on it is ink — white would be
            2.97:1 on this exact fill. */}
        <View style={styles.banner}>
          <View style={styles.bannerTop}>
            <PressableScale onPress={goBack} accessibilityLabel="Go back">
              <Icon name="arrow-left" size={s(22)} color={colors.textOnOrange} />
            </PressableScale>
          </View>

          <Thumb
            id={team.id}
            name={team.name}
            uri={team.crestUrl}
            dimension={s(96)}
            circular
            style={styles.crest}
          />
          <Text
            variant="screenTitle"
            color={colors.textOnOrange}
            align="center"
            style={styles.name}
          >
            {team.name}
          </Text>
          <Text variant="bodySmall" color={colors.textOnOrange} align="center" style={styles.sub}>
            {SPORT_LABELS[team.sport]} · {CITY_LABELS[team.city]}
          </Text>
        </View>

        <View style={styles.body}>
          <View style={styles.stats}>
            <Stat label="Won" value={String(team.wins)} />
            <View style={styles.statRule} />
            <Stat label="Lost" value={String(team.losses)} />
            <View style={styles.statRule} />
            <Stat label="Win rate" value={winRate === null ? '—' : `${winRate}%`} />
            <View style={styles.statRule} />
            <Stat
              label={`in ${CITY_LABELS[team.city]}`}
              value={team.cityRank === null ? '—' : `#${team.cityRank}`}
            />
          </View>

          <View style={styles.actions}>
            {isCaptain ? (
              <Button
                label="Post a challenge"
                style={styles.action}
                onPress={() =>
                  router.push({ pathname: '/challenge/create', params: { teamId: team.id } })
                }
                testID="post-challenge"
              />
            ) : (
              <Button
                label="Challenge this team"
                style={styles.action}
                onPress={() =>
                  router.push({ pathname: '/challenge/create', params: { opponentId: team.id } })
                }
                testID="challenge-team"
              />
            )}
            <Button
              label="Invite"
              variant="soft"
              style={styles.actionNarrow}
              onPress={() => router.push('/match/invite')}
              testID="team-invite"
            />
          </View>

          <Text variant="cardTitle" style={styles.sectionTitle}>
            Squad ({team.memberIds.length})
          </Text>

          {members.isPending ? (
            <ActivityIndicator color={colors.orange} style={styles.loader} />
          ) : (
            (members.data ?? []).map((player, index) => (
              <View key={player.id}>
                {renderMember(player)}
                {index < (members.data ?? []).length - 1 ? <Divider /> : null}
              </View>
            ))
          )}

          {openChallenges.length > 0 ? (
            <>
              <Text variant="cardTitle" style={styles.sectionTitle}>
                Open challenges
              </Text>
              {openChallenges.map((challenge) => (
                <View key={challenge.id} style={styles.challenge}>
                  <View style={styles.challengeText}>
                    <Text variant="bodySmall">{FORMAT_LABELS[challenge.format]}</Text>
                    <Text variant="meta" color={colors.textSecondary}>
                      {challenge.area} ·{' '}
                      {formatSlotShort(challenge.proposedStartAt, { abbreviateWeekday: true })}
                    </Text>
                  </View>
                  <View style={styles.stake}>
                    <Text variant="metaStrong" color={colors.orangeDeep} uppercase>
                      {STAKE_LABELS[challenge.stake]}
                    </Text>
                  </View>
                </View>
              ))}
            </>
          ) : null}
        </View>
      </ScrollView>
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat} accessible accessibilityLabel={`${value} ${label}`}>
      <Text variant="cardTitle" style={styles.statValue}>
        {value}
      </Text>
      <Text variant="meta" color={colors.textSecondary} align="center">
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  loader: { marginTop: s(48) },
  scroll: { paddingBottom: spacing.xxl },

  banner: {
    backgroundColor: colors.orange,
    paddingTop: s(56),
    paddingBottom: s(34),
    paddingHorizontal: spacing.gutter,
    borderBottomLeftRadius: radius.sheet,
    borderBottomRightRadius: radius.sheet,
    alignItems: 'center',
  },
  bannerTop: { alignSelf: 'flex-start', marginBottom: s(18) },
  crest: { borderWidth: s(3), borderColor: colors.surfaceOnDark },
  name: { marginTop: s(14) },
  sub: { opacity: 0.8, marginTop: s(2) },

  body: { paddingHorizontal: spacing.gutter, backgroundColor: colors.background },
  stats: { flexDirection: 'row', alignItems: 'center', paddingVertical: s(24) },
  stat: { flex: 1, alignItems: 'center', gap: s(4) },
  statValue: { fontSize: s(20), lineHeight: s(26) },
  statRule: { width: StyleSheet.hairlineWidth, height: s(32), backgroundColor: colors.border },

  actions: { flexDirection: 'row', gap: spacing.md },
  action: { flex: 1 },
  actionNarrow: { width: s(104) },

  sectionTitle: { marginTop: s(30), marginBottom: spacing.md },
  member: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, paddingVertical: s(10) },
  memberText: { flex: 1, gap: s(3) },
  reliability: { alignItems: 'flex-end' },

  challenge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderRadius: radius.card,
    backgroundColor: colors.card,
  },
  challengeText: { flex: 1, gap: s(3) },
  stake: {
    paddingHorizontal: s(10),
    paddingVertical: s(6),
    borderRadius: radius.chip,
    backgroundColor: colors.orangeWash,
  },
});
