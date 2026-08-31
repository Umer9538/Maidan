/**
 * Match detail and join — the consumer side of Pillar 2, which docs/07 §5 lists as a gap:
 * "Join-match flow — request → host approval → pay share."
 *
 * Before this, tapping a match card joined it outright: a silent mutation with no
 * confirmation, no sight of who else is playing, and no mention of the money owed. Joining
 * a game costs a player real rupees, so it gets a screen.
 *
 * The two join modes are the host's choice, made when they opened the match. Instant join
 * commits immediately; otherwise the request queues for the host, and the copy says so
 * rather than implying a seat is held.
 */
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
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
import { ApiError } from '@/data/api';
import { useJoinMatch, useMyMatches, useOpenMatch, usePlayer, useVenue } from '@/data/queries';
import { FORMAT_LABELS, GENDER_LABELS, SKILL_LABELS, SPORT_LABELS } from '@/domain/labels';
import { formatOpeningHours, formatSlotShort } from '@/lib/datetime';
import type { OpenMatch } from '@/domain/types';
import { formatPkr } from '@/lib/money';
import { useGoBack } from '@/lib/navigation';
import { colors, radius, s, size, spacing } from '@/theme';

export default function MatchDetailScreen() {
  const { matchId } = useLocalSearchParams<{ matchId: string }>();
  const router = useRouter();
  const goBack = useGoBack('/(tabs)/matches');

  const match = useOpenMatch(matchId);
  const venue = useVenue(match.data?.venueId ?? '');
  const host = usePlayer(match.data?.hostId);
  const mine = useMyMatches();
  const join = useJoinMatch();

  const [failure, setFailure] = useState<string | null>(null);
  const [requested, setRequested] = useState(false);

  const alreadyIn = (mine.data ?? []).some((each) => each.id === matchId);

  if (match.isPending) {
    return (
      <Screen>
        <ActivityIndicator style={styles.loader} color={colors.orange} />
      </Screen>
    );
  }

  if (!match.data) {
    return (
      <Screen>
        <AppBar title="Match" onBack={goBack} />
        <EmptyState
          icon="users"
          title="That match is gone"
          body="It may have filled up or been cancelled. Have a look at what else is open."
          actionLabel="See open matches"
          onAction={() => router.replace('/(tabs)/matches')}
        />
      </Screen>
    );
  }

  const data: OpenMatch = match.data;
  const spotsLeft = Math.max(0, data.playersNeeded - data.playersJoined);
  const full = spotsLeft === 0;

  const send = () => {
    setFailure(null);
    join.mutate(matchId, {
      onSuccess: () => {
        if (data.instantJoin) router.replace('/schedule');
        else setRequested(true);
      },
      onError: (error) => {
        if (error instanceof ApiError && error.code === 'slot_taken') {
          setFailure('That match just filled up.');
          return;
        }
        setFailure('We could not join you. Try again.');
      },
    });
  };

  return (
    <Screen>
      <AppBar title="Open match" onBack={goBack} />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text variant="screenTitle">{FORMAT_LABELS[data.format]}</Text>
          <Text variant="bodySmall" color={colors.textSecondary}>
            {formatSlotShort(data.startAt)} · {venue.data?.name ?? ''}
          </Text>
        </View>

        {/* Spots left is the thing a player is deciding on, so it leads. */}
        <View style={[styles.spots, full && styles.spotsFull]}>
          <Text variant="cardTitle" color={full ? colors.textSecondary : colors.orangeDeep}>
            {full
              ? 'This match is full'
              : `${spotsLeft} ${spotsLeft === 1 ? 'spot' : 'spots'} left`}
          </Text>
          <Text variant="meta" color={colors.textSecondary}>
            {data.playersJoined} of {data.playersNeeded} joined
          </Text>
        </View>

        <View style={styles.facts}>
          <Fact icon="location" label="Where" value={venue.data?.area ?? ''} />
          <Fact
            icon="clock"
            label="Ground hours"
            value={
              venue.data
                ? formatOpeningHours(venue.data.hours.opensAt, venue.data.hours.closesAt)
                : ''
            }
          />
          <Fact icon="trophy" label="Level" value={SKILL_LABELS[data.skillLevel]} />
          <Fact icon="users" label="Open to" value={GENDER_LABELS[data.genderPreference]} />
          <Fact icon="shield" label="Sport" value={SPORT_LABELS[data.sport]} />
        </View>

        {data.note ? (
          <View style={styles.note}>
            <Text variant="bodySmall" color={colors.textSecondary}>
              “{data.note}”
            </Text>
          </View>
        ) : null}

        <Divider style={styles.divider} />

        <PressableScale
          onPress={() => router.push(`/owner/${data.hostId}`)}
          accessibilityLabel={`${host.data?.name ?? 'Host'}, view profile`}
          style={styles.host}
        >
          <Thumb
            id={data.hostId}
            name={host.data?.name ?? 'Host'}
            uri={host.data?.avatarUrl}
            dimension={size.actionCircle}
            circular
          />
          <View style={styles.hostText}>
            <Text variant="bodySmall">{host.data?.name ?? 'Host'}</Text>
            <Text variant="meta" color={colors.textSecondary}>
              Host · {host.data?.reliability ?? 0}% reliable
            </Text>
          </View>
          <Icon name="chevron-right" size={s(18)} color={colors.orange} />
        </PressableScale>

        <View style={styles.share}>
          <Icon name="wallet" size={s(18)} color={colors.orange} bold />
          <View style={styles.shareText}>
            <Text variant="cardTitle">{formatPkr(data.pricePerPlayer)}</Text>
            <Text variant="meta" color={colors.textSecondary}>
              Your share, paid to the host&apos;s booking
            </Text>
          </View>
        </View>

        {failure ? (
          <Text variant="meta" color={colors.danger} style={styles.failure}>
            {failure}
          </Text>
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        {alreadyIn || requested ? (
          <View style={styles.state}>
            <Icon name="check-circle" size={s(18)} color={colors.orange} bold />
            <Text variant="bodySmall" style={styles.stateText}>
              {requested && !data.instantJoin
                ? 'Request sent. The host will confirm — you are not counted until they do.'
                : 'You are in this match. It is on your schedule.'}
            </Text>
          </View>
        ) : (
          <>
            <Text variant="meta" color={colors.textSecondary} style={styles.terms}>
              {data.instantJoin
                ? `You join straight away and owe ${formatPkr(data.pricePerPlayer)}.`
                : 'The host approves each request. Nothing is owed until they do.'}
            </Text>
            <Button
              label={data.instantJoin ? `Join · ${formatPkr(data.pricePerPlayer)}` : 'Ask to join'}
              onPress={send}
              disabled={full}
              loading={join.isPending}
              testID="match-join"
            />
          </>
        )}
      </View>
    </Screen>
  );
}

function Fact({
  icon,
  label,
  value,
}: {
  icon: 'location' | 'clock' | 'trophy' | 'users' | 'shield';
  label: string;
  value: string;
}) {
  if (!value) return null;
  return (
    <View style={styles.fact}>
      <Icon name={icon} size={s(16)} color={colors.orange} bold />
      <Text variant="meta" color={colors.textSecondary} style={styles.factLabel}>
        {label}
      </Text>
      <Text variant="bodySmall" numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  loader: { marginTop: s(48) },
  scroll: { paddingHorizontal: spacing.gutter, paddingBottom: spacing.xxl },
  header: { gap: s(6), marginTop: spacing.md },

  spots: {
    marginTop: spacing.xl,
    padding: spacing.lg,
    borderRadius: radius.card,
    backgroundColor: colors.orangeWash,
    gap: s(3),
  },
  spotsFull: { backgroundColor: colors.surfaceMuted },

  facts: { marginTop: spacing.xl, gap: spacing.md },
  fact: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  factLabel: { width: s(86) },

  note: {
    marginTop: spacing.xl,
    padding: spacing.lg,
    borderRadius: radius.card,
    backgroundColor: colors.card,
  },
  divider: { marginVertical: spacing.xl },

  host: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  hostText: { flex: 1, gap: s(3) },

  share: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.xl,
    padding: spacing.lg,
    borderRadius: radius.card,
    backgroundColor: colors.card,
  },
  shareText: { flex: 1, gap: s(3) },
  failure: { marginTop: spacing.md },

  footer: {
    paddingHorizontal: spacing.gutter,
    paddingBottom: spacing.xxl,
    paddingTop: spacing.md,
    gap: spacing.md,
  },
  terms: { lineHeight: s(16) },
  state: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  stateText: { flex: 1, lineHeight: s(18) },
});
