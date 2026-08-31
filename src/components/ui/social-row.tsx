/**
 * The `or continue with` block from frames 06 and 07.
 *
 * Measured: the rule and label at y554, then three 54pt buttons spanning 273 centred —
 * about 80 wide with 16 between them.
 */
import { StyleSheet, View } from 'react-native';

import { BrandIcon, type BrandName } from '@/components/brand-icons';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { colors, radius, s, spacing } from '@/theme';

export interface SocialProvider {
  name: BrandName;
  label: string;
  onPress?: () => void;
}

export function SocialRow({ providers }: { providers: SocialProvider[] }) {
  // Same rule as AppBar: a provider we cannot actually sign anyone in with does not render.
  const live = providers.filter((provider) => typeof provider.onPress === 'function');
  if (live.length === 0) return null;

  return (
    <>
      <View style={styles.dividerRow}>
        <View style={styles.rule} />
        <Text variant="bodySmall" color={colors.textSecondary}>
          or continue with
        </Text>
        <View style={styles.rule} />
      </View>

      <View style={styles.row}>
        {live.map((provider) => (
          <PressableScale
            key={provider.name}
            onPress={provider.onPress}
            accessibilityLabel={provider.label}
            style={styles.button}
            testID={`social-${provider.name}`}
          >
            <BrandIcon name={provider.name} size={s(26)} />
          </PressableScale>
        ))}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  rule: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  row: { flexDirection: 'row', justifyContent: 'center', gap: s(16), marginTop: s(55) },
  button: {
    width: s(80),
    height: s(54),
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
