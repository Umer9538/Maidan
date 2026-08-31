/**
 * Development bypass for the onboarding and auth gates.
 *
 * Building a screen that sits behind sign-in otherwise means walking the whole first-run
 * flow on every reload, and it makes deep-linking straight to a route impossible — which
 * is exactly how screens get verified during a build.
 *
 * Opt-in and double-guarded: the flag only reads in a development build, so it cannot
 * follow a release bundle out the door even if the variable is set in the environment.
 * Turn it on with `EXPO_PUBLIC_DEV_SKIP_GATES=1 npx expo start`.
 */
export const skipGates = __DEV__ && process.env.EXPO_PUBLIC_DEV_SKIP_GATES === '1';
