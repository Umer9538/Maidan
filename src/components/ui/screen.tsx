/**
 * Screen shell: background, safe-area insets, and the status-bar style.
 *
 * The Figma frames bake in a 375x812 iOS status bar. That is a mockup convention, not a
 * layout — real devices report their own insets, and Android notches differ — so the
 * drawn bar is dropped and `useSafeAreaInsets` supplies the real top padding.
 *
 * On a tablet or an unfolded foldable the column stops at `CONTENT_MAX_WIDTH` and centres.
 * A phone layout stretched to 800pt does not become a tablet layout — it becomes a phone
 * layout with 200pt of dead space in every row — so the design holds its width and the
 * surrounding ground shows through instead.
 */
import { StatusBar } from 'expo-status-bar';
import type { ReactNode } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CONTENT_MAX_WIDTH, colors, isWideViewport } from '@/theme';

export interface ScreenProps {
  children: ReactNode;
  /** Skip top padding when content runs under the status bar, e.g. a full-bleed hero. */
  edgeToEdge?: boolean;
  /** Light content for dark backgrounds. */
  statusBarStyle?: 'light' | 'dark';
  background?: string;
  style?: ViewStyle;
}

export function Screen({
  children,
  edgeToEdge = false,
  statusBarStyle = 'dark',
  background = colors.background,
  style,
}: ScreenProps) {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.screen,
        { backgroundColor: background, paddingTop: edgeToEdge ? 0 : insets.top },
        style,
      ]}
    >
      <StatusBar style={statusBarStyle} />
      {isWideViewport ? <View style={styles.column}>{children}</View> : children}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  column: { flex: 1, width: '100%', maxWidth: CONTENT_MAX_WIDTH, alignSelf: 'center' },
});
