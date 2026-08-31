/**
 * Pick your sports — frame `10_Select Interest`.
 *
 * Measured from the export: title band at y75, tiles 124 square in two columns with a 41
 * gutter, rows pitched 193 apart (tile, 18 to the label, 34 to the next tile), CTA at
 * y722 at 327x58.
 *
 * The frame offers six lifestyle interests (Design, Music, Art, Sports, Food, Others).
 * MAIDAN has exactly three sports, so the grid carries those — a "Food" tile in a
 * ground-booking app would be a template artefact, not a feature.
 */
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { IconName } from '@/components/icons';
import { Button, ChoiceTile, Screen, Text } from '@/components/ui';
import { useAuth } from '@/features/auth/context';
import { SPORT_LABELS } from '@/domain/labels';
import type { Sport } from '@/domain/types';
import { colors, size, spacing } from '@/theme';

const SPORTS: { value: Sport; icon: IconName }[] = [
  { value: 'padel', icon: 'trophy' },
  { value: 'futsal', icon: 'users' },
  { value: 'cricket', icon: 'shield' },
];

export default function SelectSportsScreen() {
  const router = useRouter();
  const { completeSetup, session } = useAuth();
  const [selected, setSelected] = useState<Sport[]>([]);

  const toggle = (sport: Sport) =>
    setSelected((current) =>
      current.includes(sport) ? current.filter((each) => each !== sport) : [...current, sport],
    );

  const next = () => {
    // A returning player already has a city; only a new one needs the next step.
    if (session?.city) {
      completeSetup(selected, session.city);
      return;
    }
    router.push({ pathname: '/(auth)/select-city', params: { sports: selected.join(',') } });
  };

  return (
    <Screen>
      <View style={styles.body}>
        <Text variant="screenTitle" align="center" style={styles.title}>
          What do you play?
        </Text>
        <Text variant="bodySmall" color={colors.textSecondary} align="center">
          Pick every sport you want to see. You can change this later.
        </Text>

        <View style={styles.grid}>
          {SPORTS.map((sport) => (
            <ChoiceTile
              key={sport.value}
              icon={sport.icon}
              label={SPORT_LABELS[sport.value]}
              selected={selected.includes(sport.value)}
              onPress={() => toggle(sport.value)}
              testID={`sport-${sport.value}`}
            />
          ))}
        </View>
      </View>

      <View style={styles.footer}>
        <Button label="Next" onPress={next} disabled={selected.length === 0} testID="sports-next" />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, paddingHorizontal: spacing.gutter },
  title: { marginTop: spacing.xl },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: size.choiceGap,
    justifyContent: 'center',
    marginTop: 44,
  },
  footer: { paddingHorizontal: spacing.gutter, paddingBottom: spacing.xxl },
});
