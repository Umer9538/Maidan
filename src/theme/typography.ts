/**
 * Type scale, Inter throughout. Source: docs/07-design-system.md §2.
 * Line heights are the Figma values in px, not multipliers.
 *
 * Sizes go through `ms()` rather than `s()`: type should move about half as much as the
 * layout around it. Text that scales one-for-one with the viewport reads as a zoomed
 * screenshot, and how large body copy renders is properly the user's Dynamic Type call,
 * not the artboard's.
 */
import type { TextStyle } from 'react-native';

import { ms } from './responsive';

export const fontFamily = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
} as const;

export const typography = {
  /** Screen title — 20/600/30. */
  screenTitle: {
    fontFamily: fontFamily.semibold,
    fontSize: ms(20),
    lineHeight: ms(30),
  },
  /** Section and card title — 14/600/17. */
  cardTitle: {
    fontFamily: fontFamily.semibold,
    fontSize: ms(14),
    lineHeight: ms(17),
  },
  /** Body — 14/400/24. */
  body: {
    fontFamily: fontFamily.regular,
    fontSize: ms(14),
    lineHeight: ms(24),
  },
  /** Secondary body — 12/400/22. */
  bodySmall: {
    fontFamily: fontFamily.regular,
    fontSize: ms(12),
    lineHeight: ms(22),
  },
  /** Meta and labels — 10/400/12. */
  meta: {
    fontFamily: fontFamily.regular,
    fontSize: ms(10),
    lineHeight: ms(12),
  },
  /** Emphasised meta — 10/600/12. Prices, card actions. */
  metaStrong: {
    fontFamily: fontFamily.semibold,
    fontSize: ms(10),
    lineHeight: ms(12),
  },
  /** Button label — 14/600/18, letter-spacing 1. */
  button: {
    fontFamily: fontFamily.semibold,
    fontSize: ms(14),
    lineHeight: ms(18),
    letterSpacing: 1,
  },
  /** Chat row title and list-row name — 14/600/17. */
  rowTitle: {
    fontFamily: fontFamily.semibold,
    fontSize: ms(14),
    lineHeight: ms(17),
  },
  /** Timestamps — 12/400/16. */
  timestamp: {
    fontFamily: fontFamily.regular,
    fontSize: ms(12),
    lineHeight: ms(16),
  },
} satisfies Record<string, TextStyle>;

export type TypographyVariant = keyof typeof typography;
