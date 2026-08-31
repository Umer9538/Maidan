/**
 * The verification code entry, from frame 08.
 *
 * Four 55pt boxes with 28 between them, spanning 304 centred in the 375 artboard. The box
 * being filled carries an orange border; empty boxes show a dash.
 *
 * A single hidden input backs all four boxes rather than one input per digit: SMS
 * autofill delivers the whole code at once, and split inputs drop everything after the
 * first character.
 */
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { colors, radius, size } from '@/theme';

export interface OtpInputProps {
  value: string;
  onChangeText: (value: string) => void;
  length?: number;
  autoFocus?: boolean;
  testID?: string;
}

export function OtpInput({
  value,
  onChangeText,
  length = 4,
  autoFocus = true,
  testID,
}: OtpInputProps) {
  const inputRef = useRef<TextInput>(null);
  const [focused, setFocused] = useState(false);

  const digits = Array.from({ length }, (_, index) => value[index] ?? '');
  const activeIndex = Math.min(value.length, length - 1);

  return (
    <Pressable
      onPress={() => inputRef.current?.focus()}
      accessibilityLabel={`Verification code, ${value.length} of ${length} digits entered`}
      style={styles.row}
      testID={testID}
    >
      {digits.map((digit, index) => {
        const active = focused && index === activeIndex;
        return (
          <View key={index} style={[styles.box, active && styles.boxActive]}>
            {digit ? (
              <Text variant="screenTitle">{digit}</Text>
            ) : (
              <Text variant="screenTitle" color={colors.border}>
                –
              </Text>
            )}
          </View>
        );
      })}

      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={(next) => onChangeText(next.replace(/\D/g, '').slice(0, length))}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        autoFocus={autoFocus}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="sms-otp"
        maxLength={length}
        style={styles.hidden}
        // The visible boxes carry the label; this must not be announced twice.
        accessibilityElementsHidden
        importantForAccessibility="no"
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: size.otpGap, justifyContent: 'center' },
  box: {
    width: size.otpBox,
    height: size.otpBox,
    borderRadius: radius.card,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxActive: { borderColor: colors.orange, borderWidth: 1.5 },
  hidden: { position: 'absolute', opacity: 0, height: 1, width: 1 },
});
