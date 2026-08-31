/**
 * Back navigation that cannot drop the user out of the app.
 *
 * `router.back()` pops the stack, and popping the last entry closes the app. A screen is
 * the first entry more often than it looks: any deep link, any notification tap, and
 * anything reached after a `replace()`. Calling `back()` there quits — which reads to a
 * player as the app crashing.
 *
 * So every screen says where "up" goes when there is no history. That is a real answer the
 * screen knows and the router does not: up from a booking is the bookings list, up from a
 * court is the venue.
 */
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { useCallback, useRef } from 'react';
import { BackHandler, Platform, ToastAndroid } from 'react-native';

export function useGoBack(fallback: Href) {
  const router = useRouter();

  return useCallback(() => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    // Nothing to pop: land on the parent rather than leaving the app.
    router.replace(fallback);
  }, [router, fallback]);
}

/** How long the first press stays armed. Long enough to be deliberate, short enough to forget. */
export const EXIT_CONFIRM_MS = 2000;

/**
 * Two presses to leave the app, not one.
 *
 * Home is the root of the task, so Android's back button exits from it outright — no
 * dialog, no warning, the app is simply gone. That is the platform default, and it is
 * wrong here: back is the same button used to climb out of a booking, and one press past
 * the bottom of the stack throws away a half-finished checkout with no way to say "no".
 *
 * A dialog would be heavier than the mistake deserves. The convention every Android user
 * in Pakistan already knows — from WhatsApp and most local apps — is a second press: the
 * first shows a toast and swallows the event, and only a second within the window leaves.
 *
 * Android only. iOS has no hardware back and no way to exit an app programmatically.
 */
export function useConfirmExit(message = 'Press back again to exit') {
  const armed = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== 'android') return;

      const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
        // Second press inside the window: fall through and let Android close the app.
        if (armed.current) return false;

        armed.current = true;
        ToastAndroid.show(message, ToastAndroid.SHORT);
        timer.current = setTimeout(() => {
          armed.current = false;
        }, EXIT_CONFIRM_MS);

        return true;
      });

      return () => {
        subscription.remove();
        if (timer.current) clearTimeout(timer.current);
        // Leaving the screen disarms it, so a press here and a press on the way back in
        // three screens later do not add up to an exit.
        armed.current = false;
      };
    }, [message]),
  );
}
