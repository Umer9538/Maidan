// @testing-library/react-native ships its jest matchers by default since v12.4,
// so this file only carries project-specific setup.

/*
 * AsyncStorage, globally.
 *
 * `DataProvider` reads the auth tokens to build the HTTP client, so the storage module is
 * now on the import path of every screen test — not just the ones that care about
 * persistence. The library ships its own in-memory mock; using it here keeps that detail
 * out of two dozen test files. Individual tests still override it where they assert on
 * what was written.
 */
jest.mock('@react-native-async-storage/async-storage', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

export {};
