/**
 * First-run state, held once for the whole app.
 *
 * The gate lives here rather than inside a screen for two reasons: a screen-level
 * `<Redirect>` only guards the screen it sits in, so any deep link into another route
 * walks straight past it; and completing onboarding has to flip the gate immediately,
 * which a hook that reads storage on mount cannot do.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import { skipGates } from '@/features/dev-gates';

import { hasCompletedOnboarding, markOnboardingComplete } from './storage';

export type OnboardingStatus = 'loading' | 'pending' | 'complete';

interface OnboardingValue {
  status: OnboardingStatus;
  complete: () => void;
}

const OnboardingContext = createContext<OnboardingValue | null>(null);

export function useOnboarding(): OnboardingValue {
  const value = useContext(OnboardingContext);
  if (!value) throw new Error('useOnboarding must be used inside <OnboardingProvider>');
  return value;
}

export function OnboardingProvider({
  children,
  /** Overridden in tests to skip the storage read. */
  initialStatus,
}: {
  children: ReactNode;
  initialStatus?: OnboardingStatus;
}) {
  const [status, setStatus] = useState<OnboardingStatus>(
    initialStatus ?? (skipGates ? 'complete' : 'loading'),
  );

  useEffect(() => {
    if (initialStatus || skipGates) return;

    let active = true;
    hasCompletedOnboarding().then((done) => {
      if (active) setStatus(done ? 'complete' : 'pending');
    });
    return () => {
      active = false;
    };
  }, [initialStatus]);

  const complete = useCallback(() => {
    // Flip the gate first so navigation is immediate; the write is a background detail
    // and a storage failure only means onboarding shows again next launch.
    setStatus('complete');
    void markOnboardingComplete();
  }, []);

  const value = useMemo(() => ({ status, complete }), [status, complete]);

  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
}
