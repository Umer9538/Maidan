/**
 * The compact list card — 327x78, the frame's `16_See All Events` row, reused for the
 * grounds list, the matches feed and the challenge board.
 *
 * Two things differ from the Figma node, deliberately:
 *
 * 1. Flow layout instead of absolute positioning. Figma places every node absolutely; real
 *    content varies in length and these lists scroll.
 * 2. The meta line truncates. In the Team Challenges frame the sub-line and the date
 *    overlap by 11-17px — "Futsal 5v5 · W12 L3" is 93px wide starting at x78, so it runs
 *    past the separator dot at x154. Letting the left half shrink fixes the collision at
 *    every string length instead of only the ones that happened to fit.
 */
import { StyleSheet, View } from 'react-native';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { Thumb } from '@/components/ui/thumb';
import { colors, radius, shadow, size, spacing } from '@/theme';

export interface ListCardProps {
  id: string;
  title: string;
  /** Left half of the meta line. Truncates before it can collide with `metaRight`. */
  metaLeft: string;
  /** Right half — a time or an area. Kept whole; these are short by construction. */
  metaRight?: string;
  photoUri?: string | null;
  /**
   * What the thumbnail stands for, when it is not the row's own title. A match row is
   * titled "Futsal 5v5 · 2 left" but its photo is the ground's, and initials taken from
   * the title spell "FL" — the monogram has to name whatever the picture is of.
   */
  photoName?: string;
  /**
   * Orange, top right. Keep it short — the column is 68px, sized from the frame's
   * "Rs 1,400". A unit suffix like "/hr" wraps onto a second line.
   */
  price?: string;
  /** Ink, bottom right. "Join Now", "Accept", "Split cost". */
  action?: string;
  /**
   * Makes the right column its own control.
   *
   * The frames label that column with a verb — JOIN NOW, ACCEPT — so it reads as the
   * action, not a caption. Without this the whole row does one thing, which forces a
   * choice between opening the record and acting on it.
   */
  onActionPress?: () => void;
  onPress?: () => void;
  accessibilityHint?: string;
  testID?: string;
}

export function ListCard({
  id,
  title,
  metaLeft,
  metaRight,
  photoUri,
  photoName,
  price,
  action,
  onActionPress,
  onPress,
  accessibilityHint,
  testID,
}: ListCardProps) {
  const spoken = [title, metaLeft, metaRight, price, action].filter(Boolean).join(', ');

  return (
    <PressableScale
      onPress={onPress}
      accessibilityLabel={spoken}
      accessibilityHint={accessibilityHint}
      testID={testID}
      style={styles.card}
    >
      <Thumb id={id} name={photoName ?? title} uri={photoUri} />

      <View style={styles.body}>
        <Text variant="cardTitle" numberOfLines={1}>
          {title}
        </Text>
        <View style={styles.meta}>
          <Text
            variant="meta"
            color={colors.textSecondary}
            numberOfLines={1}
            style={styles.metaLeft}
          >
            {metaLeft}
          </Text>
          {metaRight ? (
            <>
              <View style={styles.dot} />
              <Text variant="meta" color={colors.textSecondary} numberOfLines={1}>
                {metaRight}
              </Text>
            </>
          ) : null}
        </View>
      </View>

      {price || action ? (
        <>
          <View style={styles.rule} />
          <RightColumn onPress={onActionPress} label={action} testID={testID}>
            {price ? (
              // `orangeInk`, not the brand orange: #F76B10 on white is 2.97:1.
              <Text variant="metaStrong" color={colors.orangeInk} align="right" numberOfLines={1}>
                {price}
              </Text>
            ) : null}
            {action ? (
              <Text
                variant="metaStrong"
                color={colors.ink}
                align="right"
                uppercase
                numberOfLines={1}
              >
                {action}
              </Text>
            ) : null}
          </RightColumn>
        </>
      ) : null}
    </PressableScale>
  );
}

/** A plain column, or a button when the caller gives the action somewhere to go. */
function RightColumn({
  onPress,
  label,
  testID,
  children,
}: {
  onPress?: () => void;
  label?: string;
  testID?: string;
  children: React.ReactNode;
}) {
  if (!onPress) return <View style={styles.right}>{children}</View>;

  return (
    <PressableScale
      onPress={onPress}
      accessibilityLabel={label}
      style={styles.right}
      testID={testID ? `${testID}-action` : undefined}
    >
      {children}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    height: size.listCardHeight,
    backgroundColor: colors.card,
    borderRadius: radius.card,
    paddingLeft: 10,
    paddingRight: spacing.lg,
    ...shadow.card,
  },
  body: {
    flex: 1,
    marginLeft: 10,
    // Title (17) + gap (11) + meta (12) = 40, centred in the 58px content box, which puts
    // the title top at y19 and the meta top at y47 — the frame's values.
    gap: 11,
  },
  meta: { flexDirection: 'row', alignItems: 'center' },
  metaLeft: { flexShrink: 1 },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.orange,
    marginHorizontal: 6,
  },
  rule: {
    width: StyleSheet.hairlineWidth,
    height: 38,
    backgroundColor: colors.hairline,
    marginRight: spacing.md,
  },
  // 68 rather than the frame's 57: "Rs 1,400" fits at 57, but four-figure prices
  // with a wider action label below them do not.
  right: { width: 68, gap: 12, justifyContent: 'center' },
});
