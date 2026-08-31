/**
 * The Chats frame's 327x52 search field: white on a subtle border at radius 16, with the
 * search glyph on the right.
 */
import { StyleSheet, TextInput, View } from 'react-native';

import { Icon } from '@/components/icons';
import { colors, radius, typography } from '@/theme';

export interface SearchBarProps {
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  testID?: string;
}

export function SearchBar({ value, onChangeText, placeholder, testID }: SearchBarProps) {
  return (
    <View style={styles.bar}>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textSecondary}
        style={styles.input}
        accessibilityLabel={placeholder}
        returnKeyType="search"
        autoCorrect={false}
        testID={testID}
      />
      <Icon name="search" size={20} color={colors.orange} />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 52,
    borderRadius: radius.search,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.surfaceMuted,
    paddingHorizontal: 20,
    gap: 12,
  },
  input: {
    flex: 1,
    ...typography.bodySmall,
    color: colors.text,
    // The shared line height would otherwise clip descenders inside a TextInput.
    lineHeight: undefined,
    padding: 0,
  },
});
