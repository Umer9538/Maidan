/**
 * The only text primitive in the app.
 *
 * Screens never reach for React Native's `Text` directly (the lint config blocks it), so
 * every string in the interface picks a variant from the type scale rather than inventing
 * a size — which is how the Figma kit ended up with no published text styles at all.
 */
import { Text as RNText, type TextProps as RNTextProps, StyleSheet } from 'react-native';

import { colors, typography, type TypographyVariant } from '@/theme';

export interface TextProps extends RNTextProps {
  variant?: TypographyVariant;
  color?: string;
  align?: 'left' | 'center' | 'right';
  /** Renders the string uppercased, as the CTA and card actions do in the frames. */
  uppercase?: boolean;
}

export function Text({
  variant = 'body',
  color = colors.text,
  align,
  uppercase,
  style,
  children,
  ...rest
}: TextProps) {
  return (
    <RNText
      style={[
        typography[variant],
        { color },
        align ? { textAlign: align } : null,
        uppercase ? styles.uppercase : null,
        style,
      ]}
      {...rest}
    >
      {children}
    </RNText>
  );
}

const styles = StyleSheet.create({
  // `textTransform` rather than `String#toUpperCase` so screen readers and copy-paste
  // still get the original casing.
  uppercase: { textTransform: 'uppercase' },
});
