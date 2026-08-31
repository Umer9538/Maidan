/**
 * The auth text field, from frames 06/07/09.
 *
 * Measured from the exported frame: 327 x 48 at the 24pt gutter, a hairline border, a
 * leading glyph, and 16 between stacked fields. The frames have no layers, so these came
 * out of the pixels rather than out of Figma.
 */
import { forwardRef, useState } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { Icon, type IconName } from '@/components/icons';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { colors, radius, size, spacing, typography } from '@/theme';

export interface TextFieldProps extends Omit<TextInputProps, 'style'> {
  icon?: IconName;
  /** Fixed text before the input, e.g. the +92 dialling code. */
  prefix?: string;
  /** Shown under the field in red; also announced to a screen reader. */
  error?: string;
  /** Masks the value and adds the frame's trailing reveal toggle. */
  secure?: boolean;
}

export const TextField = forwardRef<TextInput, TextFieldProps>(function TextField(
  { icon, prefix, error, secure = false, ...rest },
  ref,
) {
  const [revealed, setRevealed] = useState(false);

  return (
    <View>
      <View style={[styles.field, error ? styles.fieldError : null]}>
        {icon ? <Icon name={icon} size={20} color={colors.textSecondary} /> : null}
        {prefix ? (
          <Text variant="body" color={colors.ink} style={styles.prefix}>
            {prefix}
          </Text>
        ) : null}
        <TextInput
          ref={ref}
          placeholderTextColor={colors.textSecondary}
          style={styles.input}
          accessibilityLabel={rest.accessibilityLabel ?? rest.placeholder}
          secureTextEntry={secure && !revealed}
          {...rest}
        />
        {secure ? (
          <PressableScale
            onPress={() => setRevealed((current) => !current)}
            accessibilityLabel={revealed ? 'Hide password' : 'Show password'}
            accessibilityState={{ selected: revealed }}
          >
            <Icon name={revealed ? 'eye' : 'eye-off'} size={20} color={colors.textSecondary} />
          </PressableScale>
        ) : null}
      </View>
      {error ? (
        <Text variant="meta" color={colors.danger} style={styles.error}>
          {error}
        </Text>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    height: size.fieldHeight,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  fieldError: { borderColor: colors.danger },
  prefix: { lineHeight: undefined },
  input: {
    flex: 1,
    ...typography.body,
    // The shared line height clips descenders inside a TextInput.
    lineHeight: undefined,
    color: colors.text,
    padding: 0,
  },
  error: { marginTop: 6, marginLeft: 4 },
});
