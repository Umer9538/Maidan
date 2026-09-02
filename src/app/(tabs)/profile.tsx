/**
 * Profile — the `48_Profile` frame, re-pointed at numbers this product actually has.
 *
 * The template's stats are Followers / Following / Events. Ours are Games / Reliability /
 * Teams: reliability is the derived score that drives the anti-no-show system, and it is
 * the number a host looks at before approving a join request, so it belongs on the profile
 * rather than buried in a match screen.
 */
import { useRouter } from 'expo-router';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';

import { Icon, type IconName } from '@/components/icons';
import { AppBar, Divider, PressableScale, Screen, Text, Thumb } from '@/components/ui';
import { useBookings, useCurrentPlayer, useTeams } from '@/data/queries';
import { useAuth } from '@/features/auth/context';
import { SKILL_LABELS, SPORT_LABELS } from '@/domain/labels';
import type { Sport } from '@/domain/types';
import { colors, s, spacing } from '@/theme';

/** Frame 48: a 96pt avatar centred at y120. */
const AVATAR = s(96);

export default function ProfileScreen() {
  const router = useRouter();
  const { session, signOut } = useAuth();
  const player = useCurrentPlayer();
  const teams = useTeams();
  const bookings = useBookings();

  const myTeams = (teams.data ?? []).filter((team) =>
    team.memberIds.includes(player.data?.id ?? ''),
  );
  const reliability = player.data?.reliability ?? 0;

  return (
    <Screen>
      <AppBar title="Profile" />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.identity}>
          <View>
            <Thumb
              id={player.data?.id ?? 'me'}
              name={player.data?.name ?? 'You'}
              uri={player.data?.avatarUrl}
              dimension={AVATAR}
              circular
            />
            <PressableScale
              onPress={() => router.push('/profile/edit')}
              accessibilityLabel="Edit profile"
              style={styles.editBadge}
              testID="edit-profile"
            >
              <Icon name="profile" size={s(14)} color={colors.textOnOrange} bold />
            </PressableScale>
          </View>
          <Text variant="screenTitle">{player.data?.name ?? ''}</Text>
        </View>

        <View style={styles.stats}>
          <Stat label="Games" value={String(player.data?.gamesPlayed ?? 0)} />
          <View style={styles.statRule} />
          <Stat label="Reliability" value={`${reliability}%`} />
          <View style={styles.statRule} />
          <Stat label="Teams" value={String(myTeams.length)} />
        </View>

        <Divider style={styles.divider} />

        <Text variant="cardTitle">About</Text>
        <Text variant="bodySmall" color={colors.textSecondary}>
          {reliability >= 90
            ? 'You show up. Hosts approve players with a reliability above 90% first, so you get into the good games.'
            : 'Your reliability is below 90%. Turning up to the matches you join brings it back up — hosts see this number before approving a request.'}
        </Text>

        <Text variant="cardTitle" style={styles.sectionTitle}>
          Skill level
        </Text>
        <View style={styles.chips}>
          {(
            Object.entries(player.data?.skillBySport ?? {}) as [Sport, keyof typeof SKILL_LABELS][]
          ).map(([sport, level]) => (
            <View key={sport} style={styles.chip}>
              <Text variant="meta" color={colors.orangeDeep}>
                {SPORT_LABELS[sport]} · {SKILL_LABELS[level]}
              </Text>
            </View>
          ))}
        </View>

        <Divider style={styles.divider} />

        {/*
          Offered to everyone, not only to existing owners. It is how someone *becomes* one:
          the launch plan is supply-first, and a ground owner who downloads the app has to
          find their way to registering without being told a URL.
        */}
        <Link
          icon="shield"
          label={(session?.ownedVenueIds.length ?? 0) > 0 ? 'My grounds' : 'List your ground'}
          detail={
            (session?.ownedVenueIds.length ?? 0) > 0
              ? `${session?.ownedVenueIds.length}`
              : undefined
          }
          onPress={() => router.push('/owner/venues')}
        />

        {/* MAIDAN staff only. Nobody else is told it exists. */}
        {player.data?.isAdmin ? (
          <Link icon="tick" label="Admin" onPress={() => router.push('/admin')} />
        ) : null}
        <Link icon="calendar" label="My schedule" onPress={() => router.push('/schedule')} />
        <Link
          icon="tick"
          label="My bookings"
          detail={`${bookings.data?.length ?? 0}`}
          onPress={() => router.push('/bookings')}
        />
        <Link icon="heart" label="Wish list" onPress={() => router.push('/saved')} />
        <Link
          icon="trophy"
          label="My teams"
          detail={`${myTeams.length}`}
          onPress={() =>
            myTeams[0] ? router.push(`/team/${myTeams[0].id}`) : router.push('/team/create')
          }
        />
        <Link icon="chat" label="Notifications" onPress={() => router.push('/notifications')} />
        <Link icon="profile" label="Edit profile" onPress={() => router.push('/profile/edit')} />
        <Link
          icon="shield"
          label="Payment methods"
          onPress={() => router.push('/payment/methods')}
        />

        <Divider />

        {/*
          Signing out sits behind a confirm because it is one row below Payment methods and
          a mistap costs the player their whole session — bookings, saved grounds and all —
          for nothing they meant to do.
        */}
        <Link
          icon="profile"
          label="Sign out"
          tone={colors.danger}
          onPress={() =>
            Alert.alert('Sign out?', 'You will need your email and password to get back in.', [
              { text: 'Stay signed in', style: 'cancel' },
              { text: 'Sign out', style: 'destructive', onPress: signOut },
            ])
          }
        />
      </ScrollView>
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat} accessible accessibilityLabel={`${value} ${label}`}>
      <Text variant="screenTitle">{value}</Text>
      <Text variant="meta" color={colors.textSecondary}>
        {label}
      </Text>
    </View>
  );
}

function Link({
  icon,
  label,
  detail,
  tone,
  onPress,
}: {
  icon: IconName;
  label: string;
  detail?: string;
  /** Overrides the orange icon and ink label — sign out is the only row that leaves. */
  tone?: string;
  onPress: () => void;
}) {
  return (
    <PressableScale onPress={onPress} accessibilityLabel={label} style={styles.link}>
      <Icon name={icon} size={20} color={tone ?? colors.orange} bold />
      <Text variant="bodySmall" color={tone} style={styles.linkLabel}>
        {label}
      </Text>
      {detail ? (
        <Text variant="meta" color={colors.textSecondary}>
          {detail}
        </Text>
      ) : null}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: spacing.gutter, paddingBottom: spacing.xxl, gap: spacing.md },
  identity: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing.lg },
  editBadge: {
    position: 'absolute',
    right: 0,
    bottom: 4,
    width: s(30),
    height: s(30),
    borderRadius: s(15),
    backgroundColor: colors.orange,
    borderWidth: 3,
    borderColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stats: { flexDirection: 'row', alignItems: 'center' },
  stat: { flex: 1, alignItems: 'center', gap: 4 },
  // Frame 48: the stat row is 35 tall with hairline dividers.
  statRule: { width: StyleSheet.hairlineWidth, height: s(35), backgroundColor: colors.border },
  divider: { marginVertical: spacing.lg },
  sectionTitle: { marginTop: spacing.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: colors.orangeWash,
  },
  link: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.lg,
  },
  linkLabel: { flex: 1 },
});
