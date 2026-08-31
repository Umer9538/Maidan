/**
 * The frames' bottom navigation: icon-only, five destinations.
 *
 * Inactive icons are Light-Outline weight in muted grey; the active one is the Bold
 * silhouette in brand orange with a 26x3 bar on the nav's top edge. Labels are omitted
 * because the frame's nav has none — so every button carries an accessibility label
 * instead, which a screen reader announces in their place.
 */
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, type IconName } from '@/components/icons';
import { PressableScale } from '@/components/ui/pressable-scale';
import { colors } from '@/theme';

/**
 * Structural props rather than `BottomTabBarProps`. expo-router ships its own copy of the
 * bottom-tab types, and importing the @react-navigation one instead makes the two
 * disagree; this bar only needs the route list and the navigator, so it asks for that.
 */
export interface TabBarProps {
  state: {
    index: number;
    routes: { key: string; name: string }[];
  };
  navigation: {
    emit(event: { type: 'tabPress'; target: string; canPreventDefault: true }): {
      defaultPrevented: boolean;
    };
    navigate(name: string): void;
  };
}

const TAB_ICONS: Record<string, { icon: IconName; label: string }> = {
  index: { icon: 'home', label: 'Home' },
  matches: { icon: 'users', label: 'Open matches' },
  challenges: { icon: 'trophy', label: 'Challenges' },
  chats: { icon: 'chat', label: 'Chats' },
  profile: { icon: 'profile', label: 'Profile' },
};

export function TabBar({ state, navigation }: TabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
      {state.routes.map((route, index) => {
        const config = TAB_ICONS[route.name];
        if (!config) return null;

        const focused = state.index === index;

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });
          if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
        };

        return (
          <PressableScale
            key={route.key}
            onPress={onPress}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={config.label}
            style={styles.tab}
            testID={`tab-${route.name}`}
          >
            {focused ? <View style={styles.indicator} /> : null}
            <Icon
              name={config.icon}
              size={24}
              color={focused ? colors.orange : colors.textSecondary}
              bold={focused}
            />
          </PressableScale>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: 14,
  },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  indicator: {
    position: 'absolute',
    top: -14,
    width: 26,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.orange,
  },
});
