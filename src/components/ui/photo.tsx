/**
 * A remote photo that always renders something.
 *
 * `expo-image` draws nothing at all while a photo is in flight and nothing at all when it
 * fails, so a venue card or a hero is a blank hole for as long as either lasts. On a
 * Pakistani mobile network both are ordinary rather than exceptional, so the fallback is
 * part of the design: a tint derived from the record's id sits underneath from the first
 * frame, carrying the monogram until a photograph actually covers it.
 */
import { Image, type ImageContentFit, type ImageStyle } from 'expo-image';
import { useEffect, useState } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Text } from '@/components/ui/text';
import { initialsOf, tintFor } from '@/lib/monogram';
import { colors } from '@/theme';

type LoadState = 'loading' | 'ready' | 'failed';

export interface PhotoProps {
  uri?: string | null;
  /** Drawn as initials until a photo covers them, and seeds the fallback tint. */
  name: string;
  id: string;
  style?: StyleProp<ViewStyle & ImageStyle>;
  contentFit?: ImageContentFit;
  /** Point size of the initials. Heroes want them larger than cards do; 0 draws none. */
  monogramSize?: number;
  testID?: string;
}

export function Photo({
  uri,
  name,
  id,
  style,
  contentFit = 'cover',
  monogramSize = 28,
  testID,
}: PhotoProps) {
  const [state, setState] = useState<LoadState>(uri ? 'loading' : 'failed');

  // A new URL deserves a fresh attempt — otherwise one failure poisons the slot for every
  // record that later reuses this component instance in a recycled list row.
  useEffect(() => setState(uri ? 'loading' : 'failed'), [uri]);

  return (
    <View
      style={[style as StyleProp<ViewStyle>, styles.ground, { backgroundColor: tintFor(id) }]}
      testID={testID}
    >
      {state !== 'ready' && monogramSize > 0 ? (
        <Text
          variant="cardTitle"
          color={colors.ink}
          // The variant's line height would clip anything larger than its own 17pt.
          style={{ fontSize: monogramSize, lineHeight: Math.round(monogramSize * 1.24) }}
        >
          {initialsOf(name)}
        </Text>
      ) : null}

      {uri && state !== 'failed' ? (
        <Image
          source={{ uri }}
          style={StyleSheet.absoluteFill}
          contentFit={contentFit}
          transition={180}
          onLoad={() => setState('ready')}
          onError={() => setState('failed')}
          accessibilityIgnoresInvertColors
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  // `overflow` matters: the photo fills the box absolutely, so without it a corner radius
  // on the incoming style would clip the tint but not the photograph on top of it.
  ground: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
});
