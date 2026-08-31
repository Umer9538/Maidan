/**
 * Splash — frame `01_Splash Screen`.
 *
 * Measured from the export: the logo block is 193 x 44 centred at y384, and the loader
 * sits at y663 — 47% and 82% of the 812pt artboard, so both are expressed as fractions
 * and hold their position on taller devices.
 *
 * This is a real screen rather than the native splash image because it stays up while the
 * session and fonts resolve; the native splash cannot animate or know when that is done.
 *
 * It shows the same wordmark asset, at the same 200pt width and on the same ground, as the
 * native splash in app.json. Anything else produces a visible jump at the hand-off.
 */
import { Image } from 'expo-image';
import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

import { colors, s } from '@/theme';

export function SplashView() {
  const spin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 1100,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    animation.start();
    return () => animation.stop();
  }, [spin]);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <View style={styles.screen}>
      <Image
        source={require('@/assets/images/maidan-wordmark.png')}
        style={styles.logo}
        contentFit="contain"
        accessibilityLabel="Maidan"
      />

      <Animated.View style={[styles.loader, { transform: [{ rotate }] }]}>
        {Array.from({ length: 8 }, (_, index) => (
          <View
            key={index}
            style={[
              styles.dot,
              {
                opacity: 0.25 + (index / 7) * 0.75,
                transform: [{ rotate: `${index * 45}deg` }, { translateY: -14 }],
              },
            ]}
          />
        ))}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Matches the native splash ground in app.json.
  screen: { flex: 1, backgroundColor: colors.background },
  logo: {
    position: 'absolute',
    // y384 of 812, the position the Figma splash puts the logo at.
    top: '47%',
    alignSelf: 'center',
    width: s(200),
    // The asset is 543 x 178.
    height: s(200) * (178 / 543),
  },
  loader: {
    position: 'absolute',
    // y663 of 812.
    top: '82%',
    alignSelf: 'center',
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    position: 'absolute',
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: colors.orange,
  },
});
