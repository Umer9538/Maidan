/**
 * The card thumbnail: a 58x58 photo at radius 10, as the frame's `Image` node specifies.
 * Records with no photo fall back to a monogram on a tint derived from their id.
 */
import type { StyleProp, ViewStyle } from 'react-native';
import type { ImageStyle } from 'expo-image';

import { Photo } from '@/components/ui/photo';
import { radius, size } from '@/theme';

export interface ThumbProps {
  uri?: string | null;
  /** Used for the monogram and to seed the fallback tint. */
  name: string;
  id: string;
  dimension?: number;
  /** Chat rows use a circular avatar; cards use the rounded square. */
  circular?: boolean;
  style?: StyleProp<ViewStyle & ImageStyle>;
}

export function Thumb({
  uri,
  name,
  id,
  dimension = size.listCardThumb,
  circular = false,
  style,
}: ThumbProps) {
  const shape = {
    width: dimension,
    height: dimension,
    borderRadius: circular ? dimension / 2 : radius.thumb,
  };

  return (
    <Photo
      uri={uri}
      name={name}
      id={id}
      style={[shape, style as StyleProp<ImageStyle>]}
      // The monogram has to scale with the thumb: a fixed size clips inside a 32pt avatar
      // and swims inside a 96pt one.
      monogramSize={Math.round(dimension * 0.34)}
    />
  );
}
