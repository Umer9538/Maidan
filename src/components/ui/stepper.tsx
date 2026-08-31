/**
 * The players-needed stepper from the Create Open Match spec (docs/07 §4).
 *
 * Both controls disable at the bounds rather than silently no-opping, so a host can tell
 * why a tap did nothing.
 */
import { StyleSheet, View } from 'react-native';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { colors, radius, s } from '@/theme';

export interface StepperProps {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  /** Announced to a screen reader, e.g. "players needed". */
  label: string;
  testID?: string;
}

export function Stepper({ value, onChange, min, max, label, testID }: StepperProps) {
  return (
    <View
      style={styles.row}
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ min, max, now: value }}
      testID={testID}
    >
      <PressableScale
        onPress={() => onChange(value - 1)}
        disabled={value <= min}
        accessibilityLabel={`Decrease ${label}`}
        style={styles.button}
        testID={testID ? `${testID}-minus` : undefined}
      >
        <Text variant="screenTitle" color={colors.orangeDeep} style={styles.sign}>
          −
        </Text>
      </PressableScale>

      <Text variant="screenTitle" align="center" style={styles.value}>
        {value}
      </Text>

      <PressableScale
        onPress={() => onChange(value + 1)}
        disabled={value >= max}
        accessibilityLabel={`Increase ${label}`}
        style={styles.button}
        testID={testID ? `${testID}-plus` : undefined}
      >
        <Text variant="screenTitle" color={colors.orangeDeep} style={styles.sign}>
          +
        </Text>
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: s(18) },
  button: {
    width: s(44),
    height: s(44),
    borderRadius: radius.chip,
    backgroundColor: colors.orangeWash,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sign: { lineHeight: s(30) },
  value: { minWidth: s(44) },
});
