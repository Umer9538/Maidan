/**
 * Bottom sheet — frame `25_Filter`.
 *
 * Measured from the export: a 43 x 5 drag handle centred at y68, a 20/600 title at y95,
 * 20pt top corners, and a footer action bar at y722 holding two 58pt buttons.
 *
 * Dismissal is on the scrim and the hardware back button as well as the handle: a sheet
 * that can only be closed by one small target is a trap on a large phone.
 */
import type { ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/ui/text';
import { CONTENT_MAX_WIDTH, colors, isWideViewport, radius, s, spacing } from '@/theme';

export interface SheetProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /** The action bar. Rendered above the safe-area inset. */
  footer?: ReactNode;
}

export function Sheet({ visible, onClose, title, children, footer }: SheetProps) {
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable style={styles.scrim} onPress={onClose} accessibilityLabel="Close filters" />

      <View style={[styles.sheet, isWideViewport && styles.sheetWide]}>
        <View style={styles.handle} />
        <Text variant="screenTitle" align="center" style={styles.title}>
          {title}
        </Text>

        <View style={styles.body}>{children}</View>

        {footer ? (
          <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.gutter) }]}>
            {footer}
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: 'rgba(32, 34, 44, 0.45)' },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    paddingTop: s(14),
    maxHeight: '88%',
  },
  sheetWide: { width: '100%', maxWidth: CONTENT_MAX_WIDTH, alignSelf: 'center' },
  handle: {
    width: s(43),
    height: s(5),
    borderRadius: s(3),
    backgroundColor: colors.border,
    alignSelf: 'center',
  },
  title: { marginTop: s(13) },
  body: { paddingHorizontal: spacing.gutter, paddingTop: spacing.gutter },
  footer: {
    flexDirection: 'row',
    gap: spacing.lg,
    paddingHorizontal: spacing.gutter,
    paddingTop: spacing.xl,
  },
});
