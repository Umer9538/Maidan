/**
 * Third-party sign-in marks, from the `or continue with` row in frames 06 and 07.
 *
 * Drawn as SVG rather than lifted from the frames: those frames are flattened, so there is
 * no asset to extract — and provider marks are trademarks with published geometry, so
 * reproducing the official paths is both more accurate and the only correct way to use them.
 */
import Svg, { Circle, Path } from 'react-native-svg';

export type BrandName = 'google' | 'apple' | 'facebook';

/** Google's four-colour G, official 48x48 geometry. */
function Google({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Path
        fill="#4285F4"
        d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z"
      />
      <Path
        fill="#34A853"
        d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z"
      />
      <Path
        fill="#FBBC05"
        d="M11.69 28.18C11.25 26.86 11 25.45 11 24s.25-2.86.69-4.18v-5.7H4.34C2.85 17.09 2 20.45 2 24s.85 6.91 2.34 9.88l7.35-5.7z"
      />
      <Path
        fill="#EA4335"
        d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z"
      />
    </Svg>
  );
}

function Apple({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        fill="#000000"
        d="M16.36 12.72c-.02-2.15 1.75-3.18 1.83-3.23-1-1.46-2.55-1.66-3.1-1.68-1.32-.13-2.58.78-3.25.78-.67 0-1.7-.76-2.8-.74-1.44.02-2.77.84-3.5 2.13-1.5 2.6-.38 6.44 1.07 8.55.71 1.03 1.55 2.19 2.66 2.15 1.07-.04 1.47-.69 2.76-.69s1.65.69 2.78.67c1.15-.02 1.88-1.05 2.58-2.09.81-1.2 1.15-2.36 1.17-2.42-.03-.01-2.24-.86-2.2-3.43zM14.3 6.4c.59-.72.99-1.72.88-2.71-.85.03-1.88.57-2.49 1.28-.55.63-1.03 1.65-.9 2.62.95.07 1.92-.48 2.51-1.19z"
      />
    </Svg>
  );
}

function Facebook({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx={12} cy={12} r={11} fill="#1877F2" />
      <Path
        fill="#FFFFFF"
        d="M15.1 13.5l.44-2.86h-2.74V8.78c0-.78.38-1.55 1.61-1.55h1.25V4.8s-1.13-.19-2.22-.19c-2.26 0-3.74 1.37-3.74 3.86v2.18H7.19v2.86h2.51v6.9a9.9 9.9 0 0 0 3.1 0v-6.9h2.3z"
      />
    </Svg>
  );
}

export function BrandIcon({ name, size = 26 }: { name: BrandName; size?: number }) {
  if (name === 'google') return <Google size={size} />;
  if (name === 'apple') return <Apple size={size} />;
  return <Facebook size={size} />;
}
