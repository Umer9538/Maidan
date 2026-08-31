// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const prettier = require('eslint-config-prettier/flat');

module.exports = defineConfig([
  expoConfig,
  prettier,
  {
    ignores: ['dist/**', 'dist-web/**', '.expo/**', 'node_modules/**', 'coverage/**'],
  },
  {
    rules: {
      // The design system forbids emoji in the UI: they render per-platform,
      // ignore currentColor, and read as unfinished. See docs/07-design-system.md.
      // esquery cannot parse `\u{...}` escapes, so the astral plane is matched through its
      // high-surrogate range instead, plus the BMP symbol blocks emoji actually live in.
      'no-restricted-syntax': [
        'error',
        {
          selector: 'Literal[value=/[\\uD800-\\uDBFF\\u2600-\\u27BF\\uFE0F\\u2B00-\\u2BFF]/]',
          message:
            'No emoji in the UI. Use an icon from @/components/icons instead (docs/07-design-system.md).',
        },
      ],
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'react-native',
              importNames: ['Text'],
              message: "Use <Text> from '@/components/ui/text' so typography tokens are applied.",
            },
          ],
        },
      ],
    },
  },
  {
    // Primitives are allowed to reach for the raw platform components they wrap.
    files: ['src/components/ui/**', 'src/theme/**'],
    rules: { 'no-restricted-imports': 'off' },
  },
]);
