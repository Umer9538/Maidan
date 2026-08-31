/**
 * The frames' header: a centred 20/600 title, a back arrow, and up to two trailing icons.
 *
 * Actions without a handler are dropped rather than rendered inert. Several kit frames
 * carry "more options" icons with nothing behind them; drawn as real buttons they take
 * focus and announce a name to a screen reader, which is worse than their absence.
 */
import { StyleSheet, View } from 'react-native';

import { Icon, type IconName } from '@/components/icons';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { colors, spacing } from '@/theme';

export interface AppBarAction {
  icon: IconName;
  accessibilityLabel: string;
  onPress?: () => void;
  /** Draws the unread dot the Home hero's bell carries. */
  badged?: boolean;
}

export interface AppBarProps {
  title?: string;
  onBack?: () => void;
  actions?: AppBarAction[];
}

export function AppBar({ title, onBack, actions = [] }: AppBarProps) {
  const live = actions.filter((action) => typeof action.onPress === 'function');

  return (
    <View style={styles.bar}>
      <View style={styles.side}>
        {onBack ? (
          <PressableScale onPress={onBack} accessibilityLabel="Go back" testID="app-bar-back">
            <Icon name="arrow-left" size={22} color={colors.ink} />
          </PressableScale>
        ) : null}
      </View>

      {title ? (
        <Text variant="screenTitle" align="center" numberOfLines={1} style={styles.title}>
          {title}
        </Text>
      ) : (
        <View style={styles.title} />
      )}

      <View style={[styles.side, styles.actions]}>
        {live.map((action) => (
          <PressableScale
            key={action.icon}
            onPress={action.onPress}
            accessibilityLabel={action.accessibilityLabel}
          >
            <View>
              <Icon name={action.icon} size={22} color={colors.ink} />
              {action.badged ? <View style={styles.dot} /> : null}
            </View>
          </PressableScale>
        ))}
      </View>
    </View>
  );
}

const SIDE_WIDTH = 64;

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    paddingHorizontal: spacing.gutter,
  },
  // Fixed side columns keep the title optically centred whatever the actions are.
  side: { width: SIDE_WIDTH },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.lg },
  title: { flex: 1 },
  dot: {
    position: 'absolute',
    top: -1,
    right: -1,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.orange,
  },
});
