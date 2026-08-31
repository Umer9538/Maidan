/**
 * The white row with an orange lead glyph and a trailing chevron, from frame 25.
 * Measured at 327 x 57 with a 12pt radius.
 *
 * Without an `onPress` it renders as plain content rather than a button — several kit
 * frames show these as tappable when nothing sits behind them, and an inert control still
 * takes focus and announces itself.
 */
import { StyleSheet, View } from 'react-native';

import { Icon, type IconName } from '@/components/icons';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { colors, radius, s, spacing } from '@/theme';

export interface FieldRowProps {
  icon: IconName;
  value: string;
  placeholder?: string;
  onPress?: () => void;
  testID?: string;
}

export function FieldRow({ icon, value, placeholder, onPress, testID }: FieldRowProps) {
  const empty = value.length === 0;
  const label = empty ? (placeholder ?? '') : value;

  const content = (
    <>
      <Icon name={icon} size={20} color={colors.orange} bold />
      <Text
        variant="body"
        color={empty ? colors.textSecondary : colors.ink}
        numberOfLines={1}
        style={styles.label}
      >
        {label}
      </Text>
      {onPress ? <Icon name="chevron-right" size={16} color={colors.orange} /> : null}
    </>
  );

  if (!onPress) {
    return <View style={styles.row}>{content}</View>;
  }

  return (
    <PressableScale onPress={onPress} accessibilityLabel={label} style={styles.row} testID={testID}>
      {content}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    height: s(57),
    borderRadius: radius.card,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  label: { flex: 1 },
});
