/**
 * Onboarding — frame `Onboarding` (node 1:427), one of the five frames that still carry
 * layers, so this geometry is read straight off the nodes rather than measured in pixels:
 *
 *   wordmark      y100, 134 wide, centred          (measured from the export)
 *   subtitle      y132
 *   illustration  x-24 y171, 423 x 256 — bleeds past both edges
 *   panel         y500, 375 x 312, top corners 40
 *     title       @73,538  229 x 60   Inter 600 20/30, centred
 *     body        @56,606  263 x 72   Inter 400 14/24, centred
 *     Skip        @56,724  Inter 600 16/19
 *     dots        @168,730 40 x 8
 *     Next        @282,724 Inter 600 16/19
 *
 * The artboard is 812 tall and real devices range from 667 to well over 1100. The panel
 * keeps its exact 312 height against the bottom edge, and the artwork centres itself in
 * whatever band is left between the wordmark and the panel — which reproduces the frame's
 * placement almost exactly at 812 and still composes on a tablet, where a fixed offset
 * left a third of the screen empty.
 *
 * The frame's 130pt orange "Glow" ellipse is not drawn: it sits behind the panel and does
 * not appear in the rendered frame, so reproducing it as a hard-edged circle would add
 * something the design does not actually show.
 */
import { Image } from 'expo-image';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { PressableScale, Screen, Text } from '@/components/ui';
import { useOnboarding } from '@/features/onboarding/context';
import { colors, ms, radius, s } from '@/theme';

/**
 * Artwork exported from the Figma file itself, not stock photography.
 *
 * Slide 1 is the `Illustration` node inside the MAIDAN Onboarding frame (1:443, 125 vector
 * children) exported at 3x. Slides 2 and 3 are cropped out of the flattened `03_Onboarding
 * 2` and `04_Onboarding 3` frames at 2x, with the flat frame background keyed out so the
 * art sits on our own surface colour.
 *
 * Note the art is the source kit's event illustration — balloons, gifts, a checklist — as
 * the Figma file stands. Only the copy was ever adapted to MAIDAN; the drawings still show
 * an events product rather than a sport.
 */
const SLIDES = [
  {
    headline: 'Book Padel, Futsal & Cricket Grounds',
    body: 'Every ground in your city — live slots, real prices. Book in seconds, pay with JazzCash or Easypaisa.',
    art: require('@/assets/images/onboarding/slide-1.png'),
  },
  {
    headline: 'Never miss a game for lack of players',
    body: 'Short two players? Open the match and let others join at your level, in your area.',
    art: require('@/assets/images/onboarding/slide-2.png'),
  },
  {
    headline: 'Challenge any team in your city',
    body: 'Post a challenge, agree a slot, split the cost — and climb the Lahore leaderboard.',
    art: require('@/assets/images/onboarding/slide-3.png'),
  },
];

export default function OnboardingScreen() {
  const { complete } = useOnboarding();
  const [index, setIndex] = useState(0);
  const slide = SLIDES[index];
  const isLast = index === SLIDES.length - 1;

  // The root layout's guard swaps the stack the moment the status flips, so finishing
  // needs no navigation of its own.
  const next = () => (isLast ? complete() : setIndex((current) => current + 1));

  return (
    <Screen edgeToEdge background={colors.background}>
      <Text variant="screenTitle" color={colors.orangeInk} align="center" style={styles.wordmark}>
        MAIDAN
      </Text>
      <Text variant="meta" color={colors.textSecondary} align="center" style={styles.tagline}>
        Book · Play · Challenge
      </Text>

      <View style={styles.artBand}>
        <Image
          source={slide.art}
          style={styles.illustration}
          // `contain`, not `cover`: the export carries the frame's exact 423 x 256 aspect and
          // cropping it would cut the artwork the design places edge to edge.
          contentFit="contain"
          transition={220}
          accessibilityIgnoresInvertColors
        />
      </View>

      <View style={styles.panel}>
        <Text variant="screenTitle" color={colors.textOnOrange} align="center" style={styles.title}>
          {slide.headline}
        </Text>
        <Text variant="body" color={colors.textOnOrange} align="center" style={styles.body}>
          {slide.body}
        </Text>

        <View style={styles.controls}>
          <PressableScale onPress={complete} accessibilityLabel="Skip onboarding">
            <Text variant="cardTitle" color={colors.textOnOrange} style={styles.control}>
              Skip
            </Text>
          </PressableScale>

          <View style={styles.dots} accessibilityLabel={`Step ${index + 1} of ${SLIDES.length}`}>
            {SLIDES.map((each, dotIndex) => (
              <View
                key={each.headline}
                style={[styles.dot, dotIndex === index && styles.dotActive]}
              />
            ))}
          </View>

          <PressableScale onPress={next} accessibilityLabel={isLast ? 'Get started' : 'Next'}>
            <Text variant="cardTitle" color={colors.textOnOrange} style={styles.control}>
              {isLast ? 'Start' : 'Next'}
            </Text>
          </PressableScale>
        </View>
      </View>
    </Screen>
  );
}

/** Panel geometry, straight from the frame. */
const PANEL_HEIGHT = s(312);
const PANEL_INSET = s(56);

const styles = StyleSheet.create({
  wordmark: { marginTop: s(100), fontSize: ms(26), lineHeight: ms(30), letterSpacing: 3 },
  tagline: { marginTop: s(7) },

  artBand: {
    position: 'absolute',
    left: 0,
    right: 0,
    // Between the wordmark block and the panel.
    top: s(150),
    bottom: PANEL_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  illustration: {
    // The frame's 423 x 256, bleeding 24 past each edge of the 375 artboard.
    width: s(423),
    height: s(256),
  },

  panel: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: PANEL_HEIGHT,
    backgroundColor: colors.orange,
    borderTopLeftRadius: radius.panel,
    borderTopRightRadius: radius.panel,
    paddingHorizontal: PANEL_INSET,
  },
  // 538 - 500 = 38 from the panel's top edge.
  title: { marginTop: s(38) },
  // 606 - 538 - 60 = 8 below the title block.
  body: { marginTop: s(8), opacity: 0.75 },
  controls: {
    position: 'absolute',
    // 724 - 500 = 224 from the panel's top edge.
    top: s(224),
    left: PANEL_INSET,
    right: PANEL_INSET,
    height: s(19),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  control: { fontSize: ms(16), lineHeight: ms(19) },
  dots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(6),
    width: s(40),
    justifyContent: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.surfaceOnDark,
    opacity: 0.5,
  },
  dotActive: { opacity: 1 },
});
