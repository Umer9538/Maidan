/**
 * Whether onboarding has been seen.
 *
 * Reads are defensive: a storage failure must land the user in the app, not lock them out
 * of it, so a failed read is treated as "not yet onboarded" and a failed write is ignored.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'maidan.onboarding.completed';

export async function hasCompletedOnboarding(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(KEY)) === 'true';
  } catch {
    return false;
  }
}

export async function markOnboardingComplete(): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, 'true');
  } catch {
    // Onboarding shows again next launch. Annoying, never blocking.
  }
}
