/**
 * The 16x16 unread badge from the Chats frame.
 *
 * The frame puts white on #29D697 — 1.88:1, the worst pairing in the file. Ink on the
 * same green is 8.41:1, so the badge keeps its colour and the numeral becomes legible.
 */
import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { colors, size } from '@/theme';

export function CountBadge({ count, label }: { count: number; label?: string }) {
  if (count <= 0) return null;

  return (
    <View style={styles.badge} accessibilityLabel={label ?? `${count} unread`} accessible>
      <Text variant="metaStrong" color={colors.textOnGreen}>
        {count > 99 ? '99+' : count}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    minWidth: size.badge,
    height: size.badge,
    borderRadius: size.badge / 2,
    paddingHorizontal: 4,
    backgroundColor: colors.green,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
