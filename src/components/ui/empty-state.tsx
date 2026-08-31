/**
 * Empty state — frames `17_Empty Events`, `20_Wish List` and `31_Empty Notification`.
 *
 * Measured from frame 17: the illustration occupies y278–450 (172 tall, full bleed), the
 * heading sits at y497 (20/600), two lines of body copy at y543 and y567, and the CTA at
 * y722 (327x58). Frame 20 uses the same rhythm with a taller 240pt illustration.
 *
 * `art` takes the illustration exported from Figma. Screens with no illustration of their
 * own fall back to a glyph in a wash circle, which is the same pattern at smaller scale.
 */
import { Image, type ImageSource } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { Icon, type IconName } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { colors, s, spacing } from '@/theme';

export interface EmptyStateProps {
  /** Illustration exported from the Figma frame. Preferred over `icon`. */
  art?: ImageSource | number;
  /** Fallback when the frame has no illustration. */
  icon?: IconName;
  title: string;
  body: string;
  actionLabel?: string;
  onAction?: () => void;
  testID?: string;
}

export function EmptyState({
  art,
  icon,
  title,
  body,
  actionLabel,
  onAction,
  testID,
}: EmptyStateProps) {
  return (
    <View style={styles.wrap} testID={testID}>
      {art ? (
        <Image
          source={art}
          style={styles.art}
          contentFit="contain"
          accessibilityIgnoresInvertColors
          // Decorative: the heading and body already say what this means.
          accessibilityElementsHidden
          importantForAccessibility="no"
        />
      ) : icon ? (
        <View style={styles.circle}>
          <Icon name={icon} size={s(32)} color={colors.orange} />
        </View>
      ) : null}

      <Text variant="screenTitle" align="center" style={styles.title}>
        {title}
      </Text>
      <Text variant="bodySmall" color={colors.textSecondary} align="center">
        {body}
      </Text>

      {actionLabel && onAction ? (
        <Button label={actionLabel} onPress={onAction} style={styles.action} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', paddingHorizontal: spacing.gutter, flexGrow: 1 },
  art: { width: '100%', height: s(200), marginTop: s(56) },
  circle: {
    width: s(88),
    height: s(88),
    borderRadius: s(44),
    backgroundColor: colors.orangeWash,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: s(56),
  },
  // Frame 17: 47 between the illustration and the heading.
  title: { marginTop: s(47), marginBottom: s(12) },
  action: { alignSelf: 'stretch', marginTop: s(48) },
});
