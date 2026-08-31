/**
 * Create a team — the entry point Pillar 3 was missing.
 *
 * Challenges need a team, and a new player has none, so the whole pillar was unreachable:
 * the challenge board showed other people's teams and there was no way to field one.
 *
 * The captain is the current player and is a member automatically. Squad-mates can be added
 * here or invited later — a team of one is a valid starting point, and forcing a roster up
 * front would stop a captain posting the challenge that recruits the roster.
 */
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, ScrollView, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/icons';
import {
  AppBar,
  Button,
  Divider,
  PillGroup,
  PressableScale,
  Screen,
  Text,
  TextField,
  Thumb,
} from '@/components/ui';
import { useCreateTeam, useSearchPlayers } from '@/data/queries';
import { useAuth } from '@/features/auth/context';
import { CITY_LABELS, SPORT_LABELS } from '@/domain/labels';
import type { City, Sport } from '@/domain/types';
import { useGoBack } from '@/lib/navigation';
import { colors, radius, s, size, spacing } from '@/theme';

const SPORTS = (['padel', 'futsal', 'cricket'] as const).map((sport) => ({
  value: sport,
  label: SPORT_LABELS[sport],
}));

export default function CreateTeamScreen() {
  const router = useRouter();
  const goBack = useGoBack('/(tabs)/challenges');
  const { session } = useAuth();
  const create = useCreateTeam();

  const [name, setName] = useState('');
  const [sport, setSport] = useState<Sport>('futsal');
  const [members, setMembers] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const players = useSearchPlayers('');
  const city = (session?.city ?? 'lahore') as City;

  const nameError = submitted && name.trim().length < 3 ? 'Give the team a name' : undefined;

  const submit = () => {
    setSubmitted(true);
    setFailure(null);
    if (name.trim().length < 3) return;

    create.mutate(
      { name, sport, city, memberIds: members },
      {
        onSuccess: (team) => router.replace(`/team/${team.id}`),
        onError: () => setFailure('We could not create that team. Try again.'),
      },
    );
  };

  return (
    <Screen>
      <AppBar title="Create a team" onBack={goBack} />

      <KeyboardAvoidingView
        style={styles.flex}
        // `padding` on both: leaving Android on `undefined` relies on the window resizing
        // under the keyboard, and SDK 54 draws edge-to-edge, so it no longer does.
        behavior="padding"
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Label>Team name</Label>
          <TextField
            icon="trophy"
            value={name}
            onChangeText={setName}
            placeholder="Gulberg Gladiators"
            autoCapitalize="words"
            error={nameError}
            accessibilityLabel="Team name"
            testID="team-name"
          />

          <Label>Sport</Label>
          <PillGroup options={SPORTS} value={sport} onChange={setSport} testID="team-sport" />
          <Text variant="meta" color={colors.textSecondary} style={styles.hint}>
            A team plays one sport. Challenges are matched on it, so a futsal team only ever faces
            other futsal teams.
          </Text>

          <Label>City</Label>
          <View style={styles.city}>
            <Icon name="location" size={s(16)} color={colors.orange} bold />
            <Text variant="bodySmall">{CITY_LABELS[city]}</Text>
          </View>

          <Divider style={styles.divider} />

          <Text variant="cardTitle">Squad</Text>
          <Text variant="meta" color={colors.textSecondary} style={styles.hint}>
            You are the captain. Add players now or invite them later — a team of one can still post
            a challenge.
          </Text>

          {(players.data ?? []).map((player) => {
            const picked = members.includes(player.id);
            return (
              <PressableScale
                key={player.id}
                onPress={() =>
                  setMembers((current) =>
                    current.includes(player.id)
                      ? current.filter((id) => id !== player.id)
                      : [...current, player.id],
                  )
                }
                accessibilityRole="checkbox"
                accessibilityState={{ checked: picked }}
                accessibilityLabel={`${player.name}, ${player.reliability}% reliable`}
                style={styles.player}
                testID={`team-member-${player.id}`}
              >
                <Thumb
                  id={player.id}
                  name={player.name}
                  uri={player.avatarUrl}
                  dimension={size.chatAvatar}
                  circular
                />
                <View style={styles.playerText}>
                  <Text variant="rowTitle" numberOfLines={1}>
                    {player.name}
                  </Text>
                  <Text variant="meta" color={colors.textSecondary}>
                    {player.reliability}% reliable · {player.gamesPlayed} games
                  </Text>
                </View>
                <View style={[styles.check, picked && styles.checkOn]}>
                  {picked ? <Icon name="tick" size={s(12)} color={colors.textOnOrange} /> : null}
                </View>
              </PressableScale>
            );
          })}

          {failure ? (
            <Text variant="meta" color={colors.danger} style={styles.failure}>
              {failure}
            </Text>
          ) : null}
        </ScrollView>

        <View style={styles.footer}>
          <Button
            label={members.length > 0 ? `Create with ${members.length + 1} players` : 'Create team'}
            onPress={submit}
            loading={create.isPending}
            testID="team-create"
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
  scroll: { paddingHorizontal: spacing.gutter, paddingBottom: spacing.xxl },
  label: { marginTop: spacing.gutter, marginBottom: spacing.md },
  hint: { marginTop: spacing.md, lineHeight: s(16) },
  city: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    height: size.fieldHeight,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  divider: { marginVertical: spacing.xl },
  player: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, paddingVertical: s(10) },
  playerText: { flex: 1, gap: s(3) },
  check: {
    width: s(24),
    height: s(24),
    borderRadius: s(12),
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkOn: { backgroundColor: colors.orange, borderColor: colors.orange },
  failure: { marginTop: spacing.md },
  footer: { paddingHorizontal: spacing.gutter, paddingBottom: spacing.xxl, paddingTop: spacing.md },
});
