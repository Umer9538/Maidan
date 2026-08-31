/**
 * A press target that dims slightly while held.
 *
 * Every tappable surface in the app goes through this so feedback is consistent, and so
 * `accessibilityRole` and a hit slop are never forgotten on the small 10px card actions.
 */
import type { ReactNode } from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';

import { hitSlop } from '@/theme';

export interface PressableScaleProps extends Omit<PressableProps, 'style' | 'children'> {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function PressableScale({ children, style, disabled, ...rest }: PressableScaleProps) {
  return (
    <Pressable
      accessibilityRole="button"
      hitSlop={hitSlop}
      disabled={disabled}
      style={({ pressed }) => [style, { opacity: disabled ? 0.4 : pressed ? 0.6 : 1 }]}
      {...rest}
    >
      {children}
    </Pressable>
  );
}
