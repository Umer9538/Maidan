/**
 * The bug this pins: one press of Android's back button on Home closed the app outright.
 * Back is also the button used to climb out of a booking, so a press past the bottom of
 * the stack threw away a half-finished checkout with nothing asked and nothing said.
 */
import { renderHook } from '@testing-library/react-native';
import { BackHandler, Platform, ToastAndroid } from 'react-native';

import { EXIT_CONFIRM_MS, useConfirmExit } from '../navigation';

// `useFocusEffect` is `useEffect` for our purposes: the screen is focused for the test.
jest.mock('expo-router', () => ({
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  useFocusEffect: require('react').useEffect,
  useRouter: () => ({ back: jest.fn(), replace: jest.fn(), canGoBack: () => false }),
}));

/** The handler the hook registers, so the test can press back with it. */
let press: (() => boolean) | null = null;
const remove = jest.fn();
let toast: jest.SpyInstance;

beforeEach(() => {
  jest.useFakeTimers();
  press = null;
  remove.mockClear();

  Platform.OS = 'android';
  toast = jest.spyOn(ToastAndroid, 'show').mockImplementation(() => {});
  jest.spyOn(BackHandler, 'addEventListener').mockImplementation((_event, handler) => {
    press = handler as () => boolean;
    return { remove } as ReturnType<typeof BackHandler.addEventListener>;
  });
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

it('swallows the first press and says so instead of closing the app', async () => {
  await renderHook(() => useConfirmExit());

  // `false` lets Android close the app; `true` means we handled it and it stays open.
  expect(press?.()).toBe(true);
  expect(toast).toHaveBeenCalledWith('Press back again to exit', ToastAndroid.SHORT);
});

it('lets the second press through', async () => {
  await renderHook(() => useConfirmExit());

  press?.();

  expect(press?.()).toBe(false);
});

it('re-arms after the window, so two stray presses minutes apart do not add up to an exit', async () => {
  await renderHook(() => useConfirmExit());

  expect(press?.()).toBe(true);
  jest.advanceTimersByTime(EXIT_CONFIRM_MS + 1);

  expect(press?.()).toBe(true);
  expect(toast).toHaveBeenCalledTimes(2);
});

it('drops the handler when the screen loses focus', async () => {
  // Otherwise Home keeps swallowing back presses from every screen pushed on top of it.
  const { unmount } = await renderHook(() => useConfirmExit());

  await unmount();

  expect(remove).toHaveBeenCalledTimes(1);
});

it('does nothing on iOS, which has no hardware back and cannot exit an app', async () => {
  Platform.OS = 'ios';

  await renderHook(() => useConfirmExit());

  expect(BackHandler.addEventListener).not.toHaveBeenCalled();
});
