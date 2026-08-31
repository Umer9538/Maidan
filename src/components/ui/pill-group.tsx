/**
 * The Filter sheet's pills: peach when idle, brand orange when selected.
 *
 * A selected pill's label is ink, not white — it sits directly on the orange fill.
 */
import { StyleSheet, View } from 'react-native';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { colors, radius, shadow } from '@/theme';

export interface PillOption<T extends string> {
  value: T;
  label: string;
}

export interface PillGroupProps<T extends string> {
  options: PillOption<T>[];
  /** A single value, or a set when `multiple` is on. */
  value: T | T[] | null;
  onChange: (value: T) => void;
  multiple?: boolean;
  /**
   * `floating` is the white pill frame 22 lays over the map. The peach wash reads as a
   * tint of whatever is behind it, which on a map is unreadable.
   */
  variant?: 'wash' | 'floating';
  testID?: string;
}

export function PillGroup<T extends string>({
  options,
  value,
  onChange,
  multiple = false,
  variant = 'wash',
  testID,
}: PillGroupProps<T>) {
  const selected = (candidate: T) =>
    multiple ? Array.isArray(value) && value.includes(candidate) : value === candidate;

  return (
    <View style={styles.group} testID={testID}>
      {options.map((option) => {
        const active = selected(option.value);
        return (
          <PressableScale
            key={option.value}
            onPress={() => onChange(option.value)}
            accessibilityRole={multiple ? 'checkbox' : 'radio'}
            accessibilityState={{ selected: active, checked: active }}
            accessibilityLabel={option.label}
            style={[
              styles.pill,
              variant === 'floating' && styles.pillFloating,
              active && styles.pillActive,
            ]}
          >
            <Text variant="metaStrong" color={active ? colors.textOnOrange : colors.orangeDeep}>
              {option.label}
            </Text>
          </PressableScale>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: {
    paddingHorizontal: 14,
    height: 34,
    borderRadius: radius.pill,
    backgroundColor: colors.orangeWash,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillFloating: { backgroundColor: colors.card, ...shadow.card },
  pillActive: { backgroundColor: colors.orange },
});
