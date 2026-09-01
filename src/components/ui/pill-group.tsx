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
  /**
   * Shown, but not choosable — a city we do not serve yet, a format this sport does not
   * have. Visible rather than hidden, so the answer to "why isn't Karachi here" is on the
   * screen instead of being a support message.
   */
  disabled?: boolean;
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
        const off = option.disabled === true;
        return (
          <PressableScale
            key={option.value}
            onPress={() => onChange(option.value)}
            disabled={off}
            accessibilityRole={multiple ? 'checkbox' : 'radio'}
            accessibilityState={{ selected: active, checked: active, disabled: off }}
            accessibilityLabel={option.label}
            style={[
              styles.pill,
              variant === 'floating' && styles.pillFloating,
              active && styles.pillActive,
              off && styles.pillDisabled,
            ]}
          >
            <Text
              variant="metaStrong"
              color={off ? colors.textSecondary : active ? colors.textOnOrange : colors.orangeDeep}
            >
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
  // Grey rather than a faded orange: the wash at low opacity still reads as tappable.
  pillDisabled: { backgroundColor: colors.surfaceMuted },
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
