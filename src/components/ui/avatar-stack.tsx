/**
 * Overlapping 20px avatars with an orange overflow chip, from the Venue Details
 * participants row. The overflow count is ink on orange, per the contrast rule.
 */
import { StyleSheet, View } from 'react-native';

import { Photo } from '@/components/ui/photo';
import { Text } from '@/components/ui/text';
import { colors } from '@/theme';

const AVATAR = 20;
const OVERLAP = 6;

export function AvatarStack({
  uris,
  overflowLabel,
  max = 4,
}: {
  uris: string[];
  overflowLabel?: string;
  max?: number;
}) {
  const shown = uris.slice(0, max);

  return (
    <View style={styles.stack} accessibilityLabel={`${uris.length} players`}>
      {shown.map((uri, index) => (
        <Photo
          key={`${uri}-${index}`}
          uri={uri}
          // Avatars here are anonymous — the stack is a count, not a roster — so the
          // fallback is a tinted disc rather than someone else's initials.
          name=""
          id={uri}
          style={[styles.avatar, index > 0 && { marginLeft: -OVERLAP }]}
          monogramSize={0}
        />
      ))}
      {overflowLabel ? (
        <View
          style={[styles.avatar, styles.overflow, shown.length > 0 && { marginLeft: -OVERLAP }]}
        >
          <Text variant="metaStrong" color={colors.textOnOrange} style={styles.overflowLabel}>
            {overflowLabel}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { flexDirection: 'row', alignItems: 'center' },
  avatar: {
    width: AVATAR,
    height: AVATAR,
    borderRadius: AVATAR / 2,
    borderWidth: 1,
    borderColor: colors.white,
    backgroundColor: colors.surfaceMuted,
  },
  overflow: { backgroundColor: colors.orange, alignItems: 'center', justifyContent: 'center' },
  overflowLabel: { fontSize: 7, lineHeight: 8 },
});
