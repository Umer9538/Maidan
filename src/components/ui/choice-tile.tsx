/**
 * The selectable tile from frame 10 (Select Your 3 Interests), reused for sports and city.
 *
 * 124 square on the muted surface, with the label below rather than inside, and an orange
 * border when selected — the frame's own selected state.
 */
import { StyleSheet, View } from 'react-native';

import { Icon, type IconName } from '@/components/icons';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { colors, radius, size } from '@/theme';

export interface ChoiceTileProps {
  icon: IconName;
  label: string;
  selected: boolean;
  onPress: () => void;
  testID?: string;
}

export function ChoiceTile({ icon, label, selected, onPress, testID }: ChoiceTileProps) {
  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected, selected }}
      accessibilityLabel={label}
      style={styles.wrap}
      testID={testID}
    >
      <View style={[styles.tile, selected && styles.tileSelected]}>
        <Icon name={icon} size={56} color={colors.orange} bold={selected} />
      </View>
      <Text variant="body" align="center" color={selected ? colors.orangeInk : colors.ink}>
        {label}
      </Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  wrap: { width: size.choiceTile, gap: 18 },
  tile: {
    width: size.choiceTile,
    height: size.choiceTile,
    borderRadius: radius.sheet,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  tileSelected: { borderColor: colors.orange, backgroundColor: colors.orangeWash },
});
