/**
 * The 74x36 price chip from Venue Details: brand orange at 16%, with the price in
 * `orangeDeep` — the darker of the three oranges, which is the one that clears AA on
 * an orange wash.
 */
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Text } from '@/components/ui/text';
import { colors, radius } from '@/theme';

export function PriceChip({ label, style }: { label: string; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.chip, style]}>
      <Text variant="metaStrong" color={colors.orangeDeep} align="center">
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    backgroundColor: colors.orangeWash,
    borderRadius: radius.chip,
    paddingHorizontal: 8,
    paddingVertical: 12,
    alignSelf: 'flex-start',
  },
});
