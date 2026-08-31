/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/react-native|native-base|react-native-svg|@tanstack/.*)',
  ],
  collectCoverageFrom: ['src/**/*.{ts,tsx}', '!src/**/*.d.ts'],
  /*
   * `server/` is a separate package with its own runner. Its tests are ESM under Node's
   * built-in test runner and hit a real Postgres; run here they fail to load, and if they
   * did load they would make `npm test` depend on a database being up. `cd server && npm
   * test` is what runs them.
   */
  testPathIgnorePatterns: ['/node_modules/', '/server/'],
};
