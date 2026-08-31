/**
 * Saved grounds — the heart toggle on the media card, and the Wish List screen.
 *
 * Held in one place so the toggle on Home and the list on Wish List cannot disagree, and
 * persisted so a save survives a relaunch. Writes are fire-and-forget: losing a save to a
 * storage error is a small cost, and blocking the toggle on a write would make it feel broken.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

const KEY = 'maidan.saved.venues';

interface SavedValue {
  savedIds: string[];
  isSaved: (venueId: string) => boolean;
  toggle: (venueId: string) => void;
}

const SavedContext = createContext<SavedValue | null>(null);

export function useSaved(): SavedValue {
  const value = useContext(SavedContext);
  if (!value) throw new Error('useSaved must be used inside <SavedProvider>');
  return value;
}

export function SavedProvider({
  children,
  initialIds,
}: {
  children: ReactNode;
  /** Overridden in tests to skip the storage read. */
  initialIds?: string[];
}) {
  const [savedIds, setSavedIds] = useState<string[]>(initialIds ?? []);

  useEffect(() => {
    if (initialIds) return;

    let active = true;
    AsyncStorage.getItem(KEY)
      .then((raw) => {
        if (!active || !raw) return;
        const parsed = JSON.parse(raw) as unknown;
        if (Array.isArray(parsed)) setSavedIds(parsed.filter((id) => typeof id === 'string'));
      })
      .catch(() => {
        // Nothing saved, as far as this launch is concerned.
      });
    return () => {
      active = false;
    };
  }, [initialIds]);

  const toggle = useCallback((venueId: string) => {
    setSavedIds((current) => {
      const next = current.includes(venueId)
        ? current.filter((id) => id !== venueId)
        : [...current, venueId];
      AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const value = useMemo<SavedValue>(
    () => ({ savedIds, isSaved: (id) => savedIds.includes(id), toggle }),
    [savedIds, toggle],
  );

  return <SavedContext.Provider value={value}>{children}</SavedContext.Provider>;
}
