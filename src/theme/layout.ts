/**
 * Geometry from the Figma artboard: 375 x 812, 24px gutter, 327px content.
 * Source: docs/07-design-system.md §2 and §6.
 *
 * Every value below is the design-time measurement passed through `s()`, so the layout
 * holds its proportions from a 320pt iPhone SE up to a tablet. The raw Figma numbers stay
 * visible in the code — that is what makes them checkable against the file.
 */
import { s } from './responsive';

export const spacing = {
  xs: s(4),
  sm: s(8),
  md: s(12),
  lg: s(16),
  xl: s(20),
  /** The content gutter. */
  gutter: s(24),
  xxl: s(32),
} as const;

export const radius = {
  handle: s(4),
  chip: s(8),
  thumb: s(10),
  /** Buttons and cards. */
  card: s(12),
  /** Search bars. */
  search: s(16),
  /** The onboarding panel and venue sheet top corners. */
  sheet: s(20),
  panel: s(40),
  pill: 999,
} as const;

export const size = {
  /** Figma artboard width — the reference the geometry was authored against. */
  artboardWidth: 375,
  /** Content column: 375 - 2 * 24. */
  contentWidth: s(327),
  /** Compact list card. */
  listCardHeight: s(78),
  /** 58x58 at inset 10,10 inside the list card. */
  listCardThumb: s(58),
  /** Primary CTA. */
  ctaHeight: s(58),
  /** Secondary outlined icon button beside the CTA. */
  iconButton: s(50),
  /** Chat row avatar. */
  chatAvatar: s(45),
  /** Owner / action circle. */
  actionCircle: s(40),
  /** Unread count badge. */
  badge: s(16),
  /** Venue hero. */
  heroHeight: s(395),
  /** Bottom action bar. */
  bottomBarHeight: s(112),

  /*
   * Measured off the flattened auth frames (exported at 2x and read back in pixels —
   * those frames carry no layers, so there is no geometry to query).
   */
  /** Text field, frames 06/07/09. */
  fieldHeight: s(48),
  /** Gap between stacked fields. */
  fieldGap: s(16),
  /** One OTP box, frame 08: four boxes of 55 with 28 between them across 304. */
  otpBox: s(55),
  otpGap: s(28),
  /** Interest tile, frame 10: 124 square, two per row with a 41 gutter. */
  choiceTile: s(124),
  choiceGap: s(41),
} as const;

/** Cards sit flat in the Figma frames; this is the softest lift that keeps them legible. */
export const shadow = {
  card: {
    shadowColor: '#20222C',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
} as const;

export const hitSlop = { top: 8, bottom: 8, left: 8, right: 8 } as const;
