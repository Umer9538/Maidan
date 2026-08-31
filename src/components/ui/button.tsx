/**
 * Buttons.
 *
 * The primary CTA is the frames' 265x58 dark gradient pill (#20222CDB -> #20222C) with a
 * 14/600 label at letter-spacing 1. `accent` is the same shape filled with brand orange —
 * and its label is ink, never white: white on #F76B10 is 2.97:1, ink is 5.33:1.
 */
import { LinearGradient } from 'expo-linear-gradient';
import { ActivityIndicator, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Icon, type IconName } from '@/components/icons';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { colors, radius, size } from '@/theme';

/**
 * `accent` is a solid brand-orange fill; `soft` is the peach wash the frames use for the
 * quieter half of a pair — Reset beside Apply, No thanks beside Rate. Getting those the
 * wrong way round makes the escape hatch the loudest thing on screen.
 */
export type ButtonVariant = 'primary' | 'accent' | 'soft' | 'secondary';

export interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  icon?: IconName;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

const labelColor: Record<ButtonVariant, string> = {
  primary: colors.textOnDark,
  accent: colors.textOnOrange,
  // On the peach wash, only the darkest orange clears AA.
  soft: colors.orangeDeep,
  secondary: colors.ink,
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  icon,
  disabled = false,
  loading = false,
  style,
  testID,
}: ButtonProps) {
  const color = labelColor[variant];

  const content = (
    <View style={styles.content}>
      {loading ? (
        <ActivityIndicator color={color} />
      ) : (
        <>
          {icon ? <Icon name={icon} size={18} color={color} bold /> : null}
          <Text variant="button" color={color} uppercase>
            {label}
          </Text>
        </>
      )}
    </View>
  );

  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      accessibilityLabel={label}
      testID={testID}
      style={[styles.base, style]}
    >
      {variant === 'primary' ? (
        <LinearGradient colors={colors.ctaGradient} style={styles.fill}>
          {content}
        </LinearGradient>
      ) : (
        <View
          style={[
            styles.fill,
            variant === 'accent' && styles.accent,
            variant === 'soft' && styles.soft,
            variant === 'secondary' && styles.secondary,
          ]}
        >
          {content}
        </View>
      )}
    </PressableScale>
  );
}

/** The 50x50 outlined square beside the CTA — bookmark, share, favourite. */
export function IconButton({
  name,
  onPress,
  accessibilityLabel,
  active = false,
  style,
  testID,
}: {
  name: IconName;
  onPress?: () => void;
  accessibilityLabel: string;
  active?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  return (
    <PressableScale
      onPress={onPress}
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected: active }}
      testID={testID}
      style={[styles.iconButton, style]}
    >
      <Icon name={name} size={22} color={active ? colors.orange : colors.ink} bold={active} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: {
    height: size.ctaHeight,
    borderRadius: radius.card,
    overflow: 'hidden',
  },
  fill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  accent: { backgroundColor: colors.orange },
  soft: { backgroundColor: colors.orangeWash },
  secondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  iconButton: {
    width: size.iconButton,
    height: size.iconButton,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
