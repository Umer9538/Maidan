/**
 * The large media card — from `12_Home`'s rail and `19_Event- Upcoming`.
 *
 * Measured off the flattened frames: a white card at radius 12 with a 10pt inset photo,
 * a favourite toggle floating top-right of the photo, a 14/600 title, orange-iconed fact
 * rows, then a footer of avatars, price and the primary action.
 *
 * Two widths, both from the frames: 250 in the horizontal rail on Home, and the full 327
 * content column in the Upcoming list.
 */
import { StyleSheet, View } from 'react-native';

import { Icon, type IconName } from '@/components/icons';
import { AvatarStack } from '@/components/ui/avatar-stack';
import { Photo } from '@/components/ui/photo';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { colors, radius, s, shadow, size } from '@/theme';

/** Rail width from frame 12: 250 wide with a 22 gap, so the next card peeks. */
export const MEDIA_CARD_RAIL_WIDTH = s(250);
export const MEDIA_CARD_RAIL_GAP = s(22);

export interface MediaCardFact {
  icon: IconName;
  label: string;
}

export interface MediaCardProps {
  title: string;
  photoUri?: string | null;
  facts: MediaCardFact[];
  /** Small avatars in the footer, with the caption beside them. */
  avatarUris?: string[];
  footerLabel?: string;
  actionLabel: string;
  onPress?: () => void;
  onToggleSaved?: () => void;
  saved?: boolean;
  /** Rail cards are fixed width; list cards fill the content column. */
  variant?: 'rail' | 'full';
  testID?: string;
}

export function MediaCard({
  title,
  photoUri,
  facts,
  avatarUris = [],
  footerLabel,
  actionLabel,
  onPress,
  onToggleSaved,
  saved = false,
  variant = 'rail',
  testID,
}: MediaCardProps) {
  return (
    <PressableScale
      onPress={onPress}
      accessibilityLabel={[title, ...facts.map((fact) => fact.label), footerLabel]
        .filter(Boolean)
        .join(', ')}
      style={[styles.card, variant === 'rail' ? styles.rail : styles.full]}
      testID={testID}
    >
      <View>
        <Photo
          uri={photoUri}
          // The title is the only stable identifier a card carries, and it is what the
          // monogram would spell out anyway, so it seeds the tint too.
          name={title}
          id={title}
          style={[styles.photo, variant === 'full' && styles.photoFull]}
          monogramSize={s(34)}
        />
        {onToggleSaved ? (
          <PressableScale
            onPress={onToggleSaved}
            accessibilityLabel={saved ? 'Remove from saved' : 'Save this ground'}
            accessibilityState={{ selected: saved }}
            style={styles.favourite}
          >
            <Icon
              name="heart"
              size={s(18)}
              color={saved ? colors.orange : colors.white}
              bold={saved}
            />
          </PressableScale>
        ) : null}
      </View>

      <Text variant="cardTitle" numberOfLines={1} style={styles.title}>
        {title}
      </Text>

      {facts.map((fact) => (
        <View key={fact.label} style={styles.factRow}>
          <Icon name={fact.icon} size={s(14)} color={colors.orange} bold />
          <Text variant="meta" color={colors.textSecondary} numberOfLines={1} style={styles.fact}>
            {fact.label}
          </Text>
        </View>
      ))}

      <View style={styles.footer}>
        {avatarUris.length > 0 ? <AvatarStack uris={avatarUris} max={3} /> : null}
        {footerLabel ? (
          <Text
            variant="meta"
            color={colors.textSecondary}
            numberOfLines={1}
            style={styles.footerLabel}
          >
            {footerLabel}
          </Text>
        ) : (
          <View style={styles.footerLabel} />
        )}
        <View style={styles.action}>
          <Text variant="metaStrong" color={colors.textOnDark} uppercase>
            {actionLabel}
          </Text>
        </View>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    padding: s(10),
    ...shadow.card,
  },
  rail: { width: MEDIA_CARD_RAIL_WIDTH },
  full: { width: size.contentWidth },
  photo: {
    width: '100%',
    height: s(167),
    borderRadius: radius.card,
    backgroundColor: colors.surfaceMuted,
  },
  photoFull: { height: s(190) },
  favourite: {
    position: 'absolute',
    top: s(10),
    right: s(10),
    width: s(36),
    height: s(36),
    borderRadius: s(18),
    backgroundColor: 'rgba(32, 34, 44, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { marginTop: s(12) },
  factRow: { flexDirection: 'row', alignItems: 'center', gap: s(6), marginTop: s(8) },
  fact: { flex: 1 },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(8),
    marginTop: s(12),
  },
  footerLabel: { flex: 1 },
  action: {
    paddingHorizontal: s(14),
    height: s(34),
    borderRadius: radius.thumb,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
