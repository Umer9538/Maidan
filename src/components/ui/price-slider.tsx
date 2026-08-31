/**
 * Price control — frame `25_Filter`'s "Select price range".
 *
 * The frame draws a dual-thumb range over a histogram. This ships a single ceiling thumb,
 * because that is the filter that exists: `VenueFilters` takes `maxPricePerHour`, and a
 * *minimum* price filter has no use to a player looking for a court they can afford. The
 * histogram behind the track is real — it is the distribution of the prices being
 * filtered, not decoration.
 *
 * Built on PanResponder rather than a slider dependency: one thumb on one axis does not
 * justify a native module in an APK that has to stay lean.
 */
import { useMemo, useRef, useState } from 'react';
import { PanResponder, StyleSheet, View, type LayoutChangeEvent } from 'react-native';

import { Text } from '@/components/ui/text';
import { formatPkr } from '@/lib/money';
import { colors, radius, s, spacing } from '@/theme';

export interface PriceSliderProps {
  min: number;
  max: number;
  value: number;
  onChange: (value: number) => void;
  /** Prices in the current result set, used to draw the distribution. */
  distribution?: number[];
  /** Rounds the thumb to a sensible increment. */
  step?: number;
  testID?: string;
}

const BAR_COUNT = 14;
const THUMB = 28;

export function PriceSlider({
  min,
  max,
  value,
  onChange,
  distribution = [],
  step = 100,
  testID,
}: PriceSliderProps) {
  const [trackWidth, setTrackWidth] = useState(0);
  // Read inside the gesture, which is created once and must not close over a stale width.
  const widthRef = useRef(0);
  const valueRef = useRef(value);
  valueRef.current = value;

  const bars = useMemo(() => {
    if (distribution.length === 0) return Array.from({ length: BAR_COUNT }, () => 0.35);
    const buckets = Array.from({ length: BAR_COUNT }, () => 0);
    for (const price of distribution) {
      const ratio = (price - min) / Math.max(1, max - min);
      const index = Math.min(BAR_COUNT - 1, Math.max(0, Math.round(ratio * (BAR_COUNT - 1))));
      buckets[index] += 1;
    }
    const peak = Math.max(...buckets, 1);
    return buckets.map((count) => 0.2 + (count / peak) * 0.8);
  }, [distribution, min, max]);

  const ratio = (value - min) / Math.max(1, max - min);

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderMove: (_, gesture) => {
        if (widthRef.current === 0) return;
        const next = Math.min(1, Math.max(0, gesture.moveX / widthRef.current));
        const raw = min + next * (max - min);
        const snapped = Math.round(raw / step) * step;
        if (snapped !== valueRef.current) onChange(snapped);
      },
    }),
  ).current;

  const onLayout = (event: LayoutChangeEvent) => {
    const width = event.nativeEvent.layout.width;
    widthRef.current = width;
    setTrackWidth(width);
  };

  return (
    <View testID={testID}>
      <View style={styles.header}>
        <Text variant="cardTitle">Price per hour</Text>
        <Text variant="cardTitle" color={colors.orangeInk}>
          Up to {formatPkr(value)}
        </Text>
      </View>

      <View style={styles.histogram}>
        {bars.map((height, index) => (
          <View
            key={index}
            style={[
              styles.bar,
              {
                height: s(52) * height,
                backgroundColor:
                  index / (BAR_COUNT - 1) <= ratio ? colors.orange : colors.orangeWash,
              },
            ]}
          />
        ))}
      </View>

      <View
        style={styles.track}
        onLayout={onLayout}
        accessibilityRole="adjustable"
        accessibilityLabel="Maximum price per hour"
        accessibilityValue={{ min, max, now: value, text: formatPkr(value) }}
        {...responder.panHandlers}
      >
        <View style={styles.rail} />
        <View style={[styles.fill, { width: Math.max(0, ratio * trackWidth) }]} />
        <View
          style={[styles.thumb, { left: Math.max(0, ratio * trackWidth - THUMB / 2) }]}
          pointerEvents="none"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  histogram: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: s(52),
    marginTop: spacing.lg,
  },
  bar: { width: s(9), borderTopLeftRadius: s(2), borderTopRightRadius: s(2) },
  track: { height: THUMB, justifyContent: 'center', marginTop: spacing.sm },
  rail: { height: s(3), borderRadius: s(2), backgroundColor: colors.orangeWash },
  fill: {
    position: 'absolute',
    height: s(3),
    borderRadius: s(2),
    backgroundColor: colors.orange,
  },
  thumb: {
    position: 'absolute',
    width: THUMB,
    height: THUMB,
    borderRadius: radius.pill,
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: colors.orange,
  },
});
