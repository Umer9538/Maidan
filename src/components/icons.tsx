/**
 * The icon set.
 *
 * The Figma frames use Iconly (`Iconly/Light-Outline/Bookmark`, `Iconly/Bold/Call` and
 * friends appear as named layers). These are matching glyphs drawn as inline SVG at a
 * 24x24 viewBox with a 1.6px stroke and round caps and joins, so they scale cleanly and
 * follow `color` — which is the whole reason the design system bans emoji: emoji render
 * differently per platform, ignore the current colour, and read as unfinished.
 *
 * Icons that the frames distinguish by state take `bold`: outline for inactive, a filled
 * silhouette for active.
 */
import { memo } from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { colors } from '@/theme';

export type IconName =
  | 'arrow-left'
  | 'bookmark'
  | 'calendar'
  | 'call'
  | 'chat'
  | 'check-circle'
  | 'chevron-right'
  | 'clock'
  | 'eye'
  | 'eye-off'
  | 'filter'
  | 'heart'
  | 'home'
  | 'location'
  | 'lock'
  | 'mail'
  | 'more-vertical'
  | 'plus'
  | 'profile'
  | 'search'
  | 'shield'
  | 'star'
  | 'tick'
  | 'timer'
  | 'trophy'
  | 'users'
  | 'wallet';

export interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
  /** Filled silhouette rather than outline. The frames use this for the active tab. */
  bold?: boolean;
}

interface GlyphProps {
  color: string;
  bold: boolean;
}

const STROKE = 1.6;

/**
 * Outline glyphs stroke their path; bold glyphs fill it. Every glyph is drawn inside the
 * same 24x24 box so mixed sizes stay optically consistent.
 */
const glyphs: Record<IconName, (props: GlyphProps) => React.ReactElement> = {
  'arrow-left': ({ color }) => (
    <Path
      d="M15 4.5 7.5 12l7.5 7.5"
      stroke={color}
      strokeWidth={STROKE}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  ),

  bookmark: ({ color, bold }) => (
    <Path
      d="M6.5 3.75h11a1 1 0 0 1 1 1v14.9a.6.6 0 0 1-.93.5L12 16.4l-5.57 3.75a.6.6 0 0 1-.93-.5V4.75a1 1 0 0 1 1-1Z"
      stroke={color}
      strokeWidth={STROKE}
      strokeLinejoin="round"
      fill={bold ? color : 'none'}
    />
  ),

  calendar: ({ color, bold }) => (
    <>
      <Rect
        x={3.25}
        y={5}
        width={17.5}
        height={15.75}
        rx={3.5}
        stroke={color}
        strokeWidth={STROKE}
        fill={bold ? color : 'none'}
      />
      <Path
        d="M3.5 9.75h17"
        stroke={bold ? colors.surfaceOnDark : color}
        strokeWidth={STROKE}
        strokeLinecap="round"
      />
      <Path
        d="M7.75 3.25v3.5M16.25 3.25v3.5"
        stroke={color}
        strokeWidth={STROKE}
        strokeLinecap="round"
      />
      {bold ? null : (
        <Path
          d="M8 13.5h.01M12 13.5h.01M16 13.5h.01M8 17h.01M12 17h.01"
          stroke={color}
          strokeWidth={2}
          strokeLinecap="round"
        />
      )}
    </>
  ),

  call: ({ color, bold }) => (
    <Path
      d="M8.1 4.3c.5-.6 1.4-.6 1.9 0l1.6 2c.4.5.4 1.2 0 1.7l-1 1.2a.9.9 0 0 0-.1 1c.7 1.4 1.9 2.6 3.3 3.3.3.2.8.1 1-.1l1.2-1c.5-.4 1.2-.4 1.7 0l2 1.6c.6.5.6 1.4.1 1.9l-1 1c-.7.8-1.8 1-2.8.7A15.6 15.6 0 0 1 6.4 8.1c-.3-1 0-2.1.7-2.8Z"
      stroke={color}
      strokeWidth={STROKE}
      strokeLinejoin="round"
      fill={bold ? color : 'none'}
    />
  ),

  'chevron-right': ({ color }) => (
    <Path
      d="m9 4.5 7.5 7.5L9 19.5"
      stroke={color}
      strokeWidth={STROKE}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  ),

  chat: ({ color, bold }) => (
    <>
      <Path
        d="M12 3.75c4.83 0 8.75 3.5 8.75 7.8 0 4.32-3.92 7.82-8.75 7.82a10 10 0 0 1-2.6-.34l-4 1.2a.5.5 0 0 1-.63-.62l1.02-3.4A7.4 7.4 0 0 1 3.25 11.55c0-4.3 3.92-7.8 8.75-7.8Z"
        stroke={color}
        strokeWidth={STROKE}
        strokeLinejoin="round"
        fill={bold ? color : 'none'}
      />
      <Path
        d="M8.5 11.5h.01M12 11.5h.01M15.5 11.5h.01"
        stroke={bold ? colors.surfaceOnDark : color}
        strokeWidth={2.2}
        strokeLinecap="round"
      />
    </>
  ),

  'check-circle': ({ color, bold }) => (
    <>
      <Circle
        cx={12}
        cy={12}
        r={8.75}
        stroke={color}
        strokeWidth={STROKE}
        fill={bold ? color : 'none'}
      />
      <Path
        d="m8.25 12.2 2.6 2.6 4.9-5"
        stroke={bold ? colors.surfaceOnDark : color}
        strokeWidth={STROKE + 0.2}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </>
  ),

  clock: ({ color, bold }) => (
    <>
      <Circle
        cx={12}
        cy={12}
        r={8.75}
        stroke={color}
        strokeWidth={STROKE}
        fill={bold ? color : 'none'}
      />
      <Path
        d="M12 7.6V12l3 1.85"
        stroke={bold ? colors.surfaceOnDark : color}
        strokeWidth={STROKE}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </>
  ),

  eye: ({ color }) => (
    <>
      <Path
        d="M2.75 12S6.5 5.75 12 5.75 21.25 12 21.25 12 17.5 18.25 12 18.25 2.75 12 2.75 12Z"
        stroke={color}
        strokeWidth={STROKE}
        strokeLinejoin="round"
        fill="none"
      />
      <Circle cx={12} cy={12} r={3.1} stroke={color} strokeWidth={STROKE} fill="none" />
    </>
  ),

  'eye-off': ({ color }) => (
    <>
      <Path
        d="M9.9 5.98A9.3 9.3 0 0 1 12 5.75c5.5 0 9.25 6.25 9.25 6.25a17 17 0 0 1-2.65 3.32M6.4 7.44A16.7 16.7 0 0 0 2.75 12S6.5 18.25 12 18.25c1.5 0 2.84-.36 4-.92"
        stroke={color}
        strokeWidth={STROKE}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <Path d="m4 3.5 16 17" stroke={color} strokeWidth={STROKE} strokeLinecap="round" />
    </>
  ),

  filter: ({ color }) => (
    <Path
      d="M4 6.25h16M7 12h10M10 17.75h4"
      stroke={color}
      strokeWidth={STROKE + 0.2}
      strokeLinecap="round"
    />
  ),

  heart: ({ color, bold }) => (
    <Path
      d="M12 20.1c-.4 0-.8-.13-1.1-.38C7.1 16.6 3.25 13.6 3.25 9.6a4.9 4.9 0 0 1 4.9-4.9c1.5 0 2.9.7 3.85 1.9a4.86 4.86 0 0 1 3.85-1.9 4.9 4.9 0 0 1 4.9 4.9c0 4-3.85 7-7.65 10.12-.3.25-.7.38-1.1.38Z"
      stroke={color}
      strokeWidth={STROKE}
      strokeLinejoin="round"
      fill={bold ? color : 'none'}
    />
  ),

  home: ({ color, bold }) => (
    <>
      <Path
        d="M3.75 10.1 12 3.6l8.25 6.5v8.4a1.9 1.9 0 0 1-1.9 1.9H5.65a1.9 1.9 0 0 1-1.9-1.9Z"
        stroke={color}
        strokeWidth={STROKE}
        strokeLinejoin="round"
        fill={bold ? color : 'none'}
      />
      <Path
        d="M9.6 20.4v-5.3h4.8v5.3"
        stroke={bold ? colors.surfaceOnDark : color}
        strokeWidth={STROKE}
        strokeLinejoin="round"
        fill="none"
      />
    </>
  ),

  location: ({ color, bold }) => (
    <>
      <Path
        d="M12 21.2c-2.6-2.3-7-6-7-10.35A7 7 0 0 1 12 3.9a7 7 0 0 1 7 6.95c0 4.34-4.4 8.05-7 10.35Z"
        stroke={color}
        strokeWidth={STROKE}
        strokeLinejoin="round"
        fill={bold ? color : 'none'}
      />
      <Circle
        cx={12}
        cy={10.6}
        r={2.5}
        stroke={bold ? colors.surfaceOnDark : color}
        strokeWidth={STROKE}
        fill="none"
      />
    </>
  ),

  lock: ({ color, bold }) => (
    <>
      <Rect
        x={4.25}
        y={10}
        width={15.5}
        height={10.75}
        rx={3}
        stroke={color}
        strokeWidth={STROKE}
        fill={bold ? color : 'none'}
      />
      <Path
        d="M7.75 10V7.6a4.25 4.25 0 0 1 8.5 0V10"
        stroke={color}
        strokeWidth={STROKE}
        strokeLinecap="round"
        fill="none"
      />
      <Circle cx={12} cy={15.4} r={1.5} fill={bold ? colors.surfaceOnDark : color} />
    </>
  ),

  mail: ({ color, bold }) => (
    <>
      <Rect
        x={2.75}
        y={5}
        width={18.5}
        height={14}
        rx={3.5}
        stroke={color}
        strokeWidth={STROKE}
        fill={bold ? color : 'none'}
      />
      <Path
        d="m5.5 8.5 5.3 3.72a2.1 2.1 0 0 0 2.4 0L18.5 8.5"
        stroke={bold ? colors.surfaceOnDark : color}
        strokeWidth={STROKE}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </>
  ),

  'more-vertical': ({ color }) => (
    <Path
      d="M12 5.5h.01M12 12h.01M12 18.5h.01"
      stroke={color}
      strokeWidth={2.4}
      strokeLinecap="round"
    />
  ),

  profile: ({ color, bold }) => (
    <>
      <Circle
        cx={12}
        cy={7.75}
        r={4}
        stroke={color}
        strokeWidth={STROKE}
        fill={bold ? color : 'none'}
      />
      <Path
        d="M4.75 20.25c0-3.4 3.25-5.6 7.25-5.6s7.25 2.2 7.25 5.6"
        stroke={color}
        strokeWidth={STROKE}
        strokeLinecap="round"
        fill={bold ? color : 'none'}
      />
    </>
  ),

  search: ({ color }) => (
    <>
      <Circle cx={11} cy={11} r={7.25} stroke={color} strokeWidth={STROKE} fill="none" />
      <Path d="m16.5 16.5 3.75 3.75" stroke={color} strokeWidth={STROKE} strokeLinecap="round" />
    </>
  ),

  shield: ({ color, bold }) => (
    <Path
      d="M12 3.4 19 6v6.1c0 4-2.9 7-7 8.5-4.1-1.5-7-4.5-7-8.5V6Z"
      stroke={color}
      strokeWidth={STROKE}
      strokeLinejoin="round"
      fill={bold ? color : 'none'}
    />
  ),

  star: ({ color, bold }) => (
    <Path
      d="m12 3.6 2.6 5.28 5.83.85-4.22 4.11.997 5.8L12 16.9l-5.21 2.74.996-5.8-4.22-4.11 5.83-.85Z"
      stroke={color}
      strokeWidth={STROKE}
      strokeLinejoin="round"
      fill={bold ? color : 'none'}
    />
  ),

  // Add. Drawn on the same 24pt box and stroke weight as the rest, so it sits level with
  // them in a bar rather than reading as a slightly different size.
  plus: ({ color }) => (
    <Path
      d="M12 5v14M5 12h14"
      stroke={color}
      strokeWidth={STROKE + 0.4}
      strokeLinecap="round"
      fill="none"
    />
  ),

  tick: ({ color }) => (
    <Path
      d="m5 12.6 4.6 4.6L19 7.8"
      stroke={color}
      strokeWidth={STROKE + 0.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  ),

  timer: ({ color }) => (
    <>
      <Circle cx={12} cy={13.25} r={7.5} stroke={color} strokeWidth={STROKE} fill="none" />
      <Path
        d="M12 9.75v3.5l2.4 1.5M9.5 2.75h5"
        stroke={color}
        strokeWidth={STROKE}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </>
  ),

  trophy: ({ color, bold }) => (
    <>
      <Path
        d="M7 4.25h10v5.1a5 5 0 0 1-10 0Z"
        stroke={color}
        strokeWidth={STROKE}
        strokeLinejoin="round"
        fill={bold ? color : 'none'}
      />
      <Path
        d="M7 5.75H4.75v1.5a3 3 0 0 0 3 3M17 5.75h2.25v1.5a3 3 0 0 1-3 3M12 14.4v3.35M8.5 20.25h7"
        stroke={color}
        strokeWidth={STROKE}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </>
  ),

  wallet: ({ color, bold }) => (
    <>
      <Rect
        x={2.75}
        y={5.75}
        width={18.5}
        height={13.5}
        rx={3.5}
        stroke={color}
        strokeWidth={STROKE}
        fill={bold ? color : 'none'}
      />
      <Path
        d="M2.75 9.75h18.5"
        stroke={bold ? colors.surfaceOnDark : color}
        strokeWidth={STROKE}
        strokeLinecap="round"
      />
      <Circle cx={17.25} cy={14.75} r={1.4} fill={bold ? colors.surfaceOnDark : color} />
    </>
  ),

  users: ({ color, bold }) => (
    <>
      <Circle
        cx={9.5}
        cy={8}
        r={3.6}
        stroke={color}
        strokeWidth={STROKE}
        fill={bold ? color : 'none'}
      />
      <Path
        d="M3.25 19.4c0-3.1 2.8-5.1 6.25-5.1s6.25 2 6.25 5.1"
        stroke={color}
        strokeWidth={STROKE}
        strokeLinecap="round"
        fill="none"
      />
      <Path
        d="M16.5 5.1a3.3 3.3 0 0 1 0 6.4M17.75 14.9c2 .55 3.25 1.9 3.25 3.6"
        stroke={color}
        strokeWidth={STROKE}
        strokeLinecap="round"
        fill="none"
      />
    </>
  ),
};

function IconComponent({ name, size = 24, color = colors.ink, bold = false }: IconProps) {
  const glyph = glyphs[name];
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {glyph({ color, bold })}
    </Svg>
  );
}

export const Icon = memo(IconComponent);
