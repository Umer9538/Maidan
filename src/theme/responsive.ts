/**
 * Scaling from the Figma artboard to real devices.
 *
 * Every number in the design system was authored against a 375 x 812 artboard. Shipping
 * those as raw points makes the app correct on exactly one device: on a 320pt iPhone SE
 * the 327 content column overflows, and on a 440pt Pro Max everything hugs the left with
 * a dead margin down the right.
 *
 * So layout values scale with the viewport width, and type scales far less — text that
 * grows in proportion to the screen reads as a zoomed screenshot rather than a bigger
 * phone, and the user's own Dynamic Type setting is the thing that should move it.
 *
 * The factor is clamped at both ends. Below 0.88 the 10pt meta line stops being legible;
 * above 1.15 a tablet would render phone furniture at absurd size, so wide screens get a
 * capped scale and a centred content column instead (see `CONTENT_MAX_WIDTH`).
 *
 * Read once at module load rather than through a hook: `StyleSheet.create` is evaluated
 * at import time, and the app is portrait-locked (app.json), so the width cannot change
 * underneath a running screen. `useResponsive` covers the cases that genuinely can.
 */
import { Dimensions, PixelRatio } from 'react-native';

/** The Figma artboard these tokens were measured against. */
export const DESIGN_WIDTH = 375;
export const DESIGN_HEIGHT = 812;

const MIN_FACTOR = 0.88;
const MAX_FACTOR = 1.15;

/** Beyond this the layout stops growing and centres itself. */
export const CONTENT_MAX_WIDTH = 480;

const { width, height } = Dimensions.get('window');

export const viewport = { width, height };

/** True for tablets and foldables, where phone furniture should stop scaling up. */
export const isWideViewport = width >= CONTENT_MAX_WIDTH;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export const scaleFactor = clamp(
  Math.min(width, CONTENT_MAX_WIDTH) / DESIGN_WIDTH,
  MIN_FACTOR,
  MAX_FACTOR,
);

/**
 * Scales a horizontal or box measurement — widths, padding, gaps, radii, icon sizes.
 * Rounded to the device pixel grid so borders and hairlines stay crisp.
 */
export function s(value: number): number {
  return PixelRatio.roundToNearestPixel(value * scaleFactor);
}

/**
 * Scales type and anything that should move less than the layout around it.
 * `factor` 0 keeps the design size; 1 matches `s`. Half is the useful default.
 */
export function ms(value: number, factor = 0.5): number {
  return PixelRatio.roundToNearestPixel(value + (value * scaleFactor - value) * factor);
}

/**
 * Scales a vertical measurement against the artboard height.
 *
 * Use sparingly. Most vertical rhythm should come from `s` so it stays proportional to
 * the horizontal grid; this is for full-height art and hero images that genuinely need to
 * track how tall the screen is.
 */
export function vs(value: number): number {
  return PixelRatio.roundToNearestPixel(
    value * clamp(height / DESIGN_HEIGHT, MIN_FACTOR, MAX_FACTOR),
  );
}
