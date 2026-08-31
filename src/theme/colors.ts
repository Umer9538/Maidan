/**
 * Colour tokens, read off the Figma layers (there are no published Figma styles).
 * Source: docs/07-design-system.md §2 and §6.4.
 *
 * The contrast rule that governs orange is not cosmetic — `--orange` #F76B10 carries
 * only 2.97:1 against white, below the 3:1 large-text floor. One orange therefore
 * cannot serve as both a fill and a text colour, so the brand orange splits three ways
 * and text sitting *on* an orange fill takes ink, never white.
 */

export const palette = {
  /** Brand orange. Fills, icons, indicators — NEVER behind white text. */
  orange: '#F76B10',
  /** Small orange text on a white/base surface. 4.58:1. */
  orangeInk: '#C4530A',
  /** Small orange text on `orangeWash`. 4.76:1. */
  orangeDeep: '#B84E09',
  /** 16% orange, the price-chip ground. */
  orangeWash: 'rgba(247, 107, 16, 0.16)',
  /**
   * `orangeWash` already flattened over `surfaceBase`. Android draws an `elevation` shadow
   * behind the view itself, and a translucent fill lets it through — the tile ends up ringed
   * in darker tan. Any surface carrying both the wash and `shadow.card` takes this instead.
   */
  orangeWashSolid: '#FAE4D5',

  ink: '#20222C',
  /** Secondary lines. #73757D was 4.44:1 on the base surface — just under AA. */
  muted: '#65676F',

  surfaceBase: '#FBFBFB',
  surfaceRaised: '#FFFFFF',
  surfaceOnDark: '#FDFDFD',
  surfaceMuted: '#F0F0EE',

  borderSubtle: '#E1E1E1',

  green: '#29D697',
  online: '#4ACD61',
  danger: '#D3453B',

  white: '#FFFFFF',
  black: '#000000',
} as const;

export const colors = {
  ...palette,

  /** Screen background. */
  background: palette.surfaceBase,
  /** Cards, sheets. */
  card: palette.surfaceRaised,

  text: palette.ink,
  textSecondary: palette.muted,
  /** Text on a dark or orange fill. */
  textOnDark: palette.surfaceOnDark,
  /**
   * Text and icons sitting ON the brand orange fill. Ink is 5.33:1 there;
   * white would be 2.97:1. Never swap this for white.
   */
  textOnOrange: palette.ink,
  /** Text on the green unread badge. Ink is 8.41:1; white is 1.88:1. */
  textOnGreen: palette.ink,

  border: palette.borderSubtle,
  /** Hairline inside cards — ink at 10%. */
  hairline: 'rgba(32, 34, 44, 0.10)',
  /** Scrim over the venue hero. */
  scrim: 'rgba(0, 0, 0, 0.20)',
  /** Translucent circle behind icons on a photo. */
  glassOnPhoto: 'rgba(255, 255, 255, 0.30)',

  /** Primary CTA gradient, top to bottom. */
  ctaGradient: ['rgba(32, 34, 44, 0.86)', '#20222C'] as const,
  /** Divider gradient: fades out at both ends. */
  dividerGradient: ['rgba(32, 34, 44, 0)', 'rgba(32, 34, 44, 0.2)', 'rgba(32, 34, 44, 0)'] as const,
} as const;

export type Colors = typeof colors;
