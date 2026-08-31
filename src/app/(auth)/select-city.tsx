/**
 * Pick your city — frame `11_Select Location`.
 *
 * The frame is a full-bleed map with a location card. A map needs a Google Maps key and
 * billing (docs/05 §2), neither of which exists yet, so this ships the same decision as a
 * list. The map replaces it once the key is in place — the choice being made is identical.
 *
 * Lahore is first and the only one live: docs/06 §2 launches there and opens Karachi and
 * Islamabad later, so offering all three as equals would promise supply we do not have.
 */
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Icon } from '@/components/icons';
import { Button, PressableScale, Screen, Text } from '@/components/ui';
import { useAuth } from '@/features/auth/context';
import { CITY_LABELS } from '@/domain/labels';
import type { City, Sport } from '@/domain/types';
import { colors, radius, spacing } from '@/theme';

const CITIES: { value: City; live: boolean; detail: string }[] = [
  { value: 'lahore', live: true, detail: 'DHA, Gulberg, Johar Town, Model Town, Cantt' },
  { value: 'karachi', live: false, detail: 'Coming soon' },
  { value: 'islamabad', live: false, detail: 'Coming soon' },
];

export default function SelectCityScreen() {
  const { completeSetup } = useAuth();
  const { sports } = useLocalSearchParams<{ sports?: string }>();
  const [city, setCity] = useState<City | null>('lahore');

  const finish = () => {
    if (!city) return;
    completeSetup((sports ?? '').split(',').filter(Boolean) as Sport[], city);
  };

  return (
    <Screen>
      <View style={styles.body}>
        <Text variant="screenTitle" align="center" style={styles.title}>
          Where do you play?
        </Text>
        <Text variant="bodySmall" color={colors.textSecondary} align="center">
          We show you grounds and matches in your city.
        </Text>

        <View style={styles.list}>
          {CITIES.map((entry) => {
            const selected = city === entry.value;
            return (
              <PressableScale
                key={entry.value}
                onPress={() => entry.live && setCity(entry.value)}
                disabled={!entry.live}
                accessibilityRole="radio"
                accessibilityState={{ selected, disabled: !entry.live }}
                accessibilityLabel={`${CITY_LABELS[entry.value]}. ${entry.detail}`}
                style={[styles.row, selected && styles.rowSelected]}
                testID={`city-${entry.value}`}
              >
                <Icon
                  name="location"
                  size={20}
                  color={entry.live ? colors.orange : colors.textSecondary}
                  bold={selected}
                />
                <View style={styles.rowText}>
                  <Text variant="cardTitle" color={entry.live ? colors.ink : colors.textSecondary}>
                    {CITY_LABELS[entry.value]}
                  </Text>
                  <Text variant="meta" color={colors.textSecondary}>
                    {entry.detail}
                  </Text>
                </View>
                {selected ? <Icon name="tick" size={16} color={colors.orange} /> : null}
              </PressableScale>
            );
          })}
        </View>
      </View>

      <View style={styles.footer}>
        <Button label="Start playing" onPress={finish} disabled={!city} testID="city-next" />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, paddingHorizontal: spacing.gutter },
  title: { marginTop: spacing.xl },
  list: { marginTop: 44, gap: spacing.md },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    minHeight: 72,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  rowSelected: { borderColor: colors.orange, backgroundColor: colors.orangeWash },
  rowText: { flex: 1, gap: 3 },
  footer: { paddingHorizontal: spacing.gutter, paddingBottom: spacing.xxl },
});
