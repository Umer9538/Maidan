/**
 * The kit's divider is a horizontal gradient of ink at 20%, fading out at both ends —
 * a nice detail worth keeping rather than flattening to a hairline.
 */
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, type ViewStyle } from 'react-native';

import { colors } from '@/theme';

export function Divider({ style }: { style?: ViewStyle }) {
  return (
    <LinearGradient
      colors={colors.dividerGradient}
      start={{ x: 0, y: 0.5 }}
      end={{ x: 1, y: 0.5 }}
      style={[styles.divider, style]}
    />
  );
}

const styles = StyleSheet.create({
  divider: { height: StyleSheet.hairlineWidth * 2, width: '100%' },
});
