/**
 * Ticks down to a deadline, once a second.
 *
 * The clock is an external system, so it is subscribed to with `useSyncExternalStore`
 * rather than mirrored into state by an effect. One shared interval drives every
 * countdown on screen, and the snapshot is cached per tick so React sees a stable value
 * within a render pass.
 *
 * Remaining time is derived from the hold's absolute `expiresAt`, never from a
 * decrementing counter: backgrounding the app suspends timers, and a counter would come
 * back showing time the server no longer honours.
 */
import { useCallback, useSyncExternalStore } from 'react';

import { secondsUntil } from '@/lib/datetime';

type Listener = () => void;

const listeners = new Set<Listener>();
let timer: ReturnType<typeof setInterval> | null = null;
let tick = Date.now();

function subscribe(listener: Listener): () => void {
  listeners.add(listener);

  if (timer === null) {
    // Refresh immediately: the module may have loaded long before the first countdown.
    tick = Date.now();
    timer = setInterval(() => {
      tick = Date.now();
      listeners.forEach((each) => each());
    }, 1000);
  }

  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && timer !== null) {
      clearInterval(timer);
      timer = null;
    }
  };
}

/** Seconds until `expiresAt`, floored at zero. Returns 0 when there is no deadline. */
export function useCountdown(expiresAt: string | undefined): number {
  const deadline = expiresAt ? new Date(expiresAt).getTime() : null;

  const getSnapshot = useCallback(() => {
    if (deadline === null) return 0;
    // Read against `tick`, which only changes once a second, so repeated calls inside a
    // single render pass agree — `useSyncExternalStore` requires a stable snapshot.
    return secondsUntil(deadline, tick);
  }, [deadline]);

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
