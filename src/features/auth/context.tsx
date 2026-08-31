/**
 * Session state: email and password, with Google as an alternative, and a phone number
 * captured at sign-up.
 *
 * A note on the product: docs/04 §4 specifies phone + OTP as the primary route because
 * Pakistani users reach for a number before an address. The screens here follow frames 06
 * and 07, which are an email form — so the app does both. Email and password is the way
 * in, and the phone number taken at sign-up is verified by the code screen (frame 08),
 * which keeps the number real for booking confirmations over SMS and WhatsApp.
 *
 * The credential calls are stubbed until the backend exists: `signIn` accepts any
 * well-formed pair, `verify` accepts any four digits. Their shapes are what the real
 * endpoints will slot into, and no password is ever persisted.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import { skipGates } from '@/features/dev-gates';

import { clearSession, readSession, writeSession, type StoredSession } from './storage';
import { isValidEmail, isValidPassword, normalisePhone } from './validation';

export type AuthStatus =
  | 'loading'
  /** No session — show sign-in. */
  | 'signed_out'
  /** Credentials accepted, but sports and a city are not chosen yet. */
  | 'needs_setup'
  | 'signed_in';

export interface SignUpInput {
  fullName: string;
  email: string;
  /** National number; the +92 prefix is added here. */
  phone: string;
  password: string;
}

export type AuthError = 'invalid_credentials' | 'email_taken' | 'weak_password' | 'network';

interface AuthValue {
  status: AuthStatus;
  session: StoredSession | null;
  /** The number a verification code was last sent to. */
  pendingPhone: string | null;
  signIn: (email: string, password: string) => Promise<AuthError | null>;
  signUp: (input: SignUpInput) => Promise<AuthError | null>;
  signInWithGoogle: () => Promise<AuthError | null>;
  requestPasswordReset: (email: string) => Promise<AuthError | null>;
  /** Resolves true when the code is accepted. */
  verify: (code: string) => Promise<boolean>;
  completeSetup: (sports: string[], city: string) => void;
  /** Saves the editable fields from the Edit Profile screen. */
  updateProfile: (patch: Pick<StoredSession, 'fullName' | 'email' | 'phone'>) => void;
  signOut: () => void;
}

const AuthContext = createContext<AuthValue | null>(null);

export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside <AuthProvider>');
  return value;
}

const OTP_LENGTH = 4;

/** Stand-in session used only when the development gate bypass is on. */
const DEV_SESSION: StoredSession = {
  id: 'player-self',
  fullName: 'Umer Farhan',
  email: 'umer@maidan.pk',
  phone: '+923001234567',
  sports: ['padel', 'futsal', 'cricket'],
  city: 'lahore',
  // The bypass session manages a venue, so the owner dashboard is reachable in development.
  ownedVenueIds: ['venue-padel-republic'],
};

export function AuthProvider({
  children,
  initialSession,
}: {
  children: ReactNode;
  /** Overridden in tests to skip the storage read. */
  initialSession?: StoredSession | null;
}) {
  const seed = initialSession ?? (skipGates ? DEV_SESSION : undefined);
  const [status, setStatus] = useState<AuthStatus>(
    seed === undefined ? 'loading' : resolveStatus(seed),
  );
  const [session, setSession] = useState<StoredSession | null>(seed ?? null);
  const [pendingPhone, setPendingPhone] = useState<string | null>(null);

  useEffect(() => {
    if (initialSession !== undefined || skipGates) return;

    let active = true;
    readSession().then((stored) => {
      if (!active) return;
      setSession(stored);
      setStatus(resolveStatus(stored));
    });
    return () => {
      active = false;
    };
  }, [initialSession]);

  const establish = useCallback((next: StoredSession) => {
    setSession(next);
    setStatus(resolveStatus(next));
    void writeSession(next);
  }, []);

  const signIn = useCallback<AuthValue['signIn']>(
    async (email, password) => {
      if (!isValidEmail(email) || !isValidPassword(password)) return 'invalid_credentials';

      // A returning player already has their sports and city; the stub keeps whatever the
      // device remembers so signing back in does not repeat setup.
      establish({
        id: session?.id ?? 'player-self',
        fullName: session?.fullName ?? 'Player',
        email: email.trim(),
        phone: session?.phone ?? '',
        sports: session?.sports ?? [],
        city: session?.city ?? null,
        ownedVenueIds: session?.ownedVenueIds ?? [],
      });
      return null;
    },
    [establish, session],
  );

  const signUp = useCallback<AuthValue['signUp']>(
    async ({ fullName, email, phone, password }) => {
      if (!isValidEmail(email)) return 'invalid_credentials';
      if (!isValidPassword(password)) return 'weak_password';

      const international = `+92${normalisePhone(phone)}`;
      setPendingPhone(international);
      establish({
        id: 'player-self',
        fullName: fullName.trim(),
        email: email.trim(),
        phone: international,
        sports: [],
        city: null,
        ownedVenueIds: [],
      });
      return null;
    },
    [establish],
  );

  const signInWithGoogle = useCallback<AuthValue['signInWithGoogle']>(async () => {
    establish({
      id: 'player-self',
      fullName: session?.fullName ?? 'Player',
      email: session?.email ?? '',
      phone: session?.phone ?? '',
      sports: session?.sports ?? [],
      city: session?.city ?? null,
      ownedVenueIds: session?.ownedVenueIds ?? [],
    });
    return null;
  }, [establish, session]);

  const requestPasswordReset = useCallback<AuthValue['requestPasswordReset']>(async (email) => {
    return isValidEmail(email) ? null : 'invalid_credentials';
  }, []);

  const verify = useCallback(async (code: string) => code.length === OTP_LENGTH, []);

  const completeSetup = useCallback(
    (sports: string[], city: string) => {
      if (!session) return;
      establish({ ...session, sports, city });
    },
    [establish, session],
  );

  const updateProfile = useCallback<AuthValue['updateProfile']>(
    (patch) => {
      if (!session) return;
      establish({ ...session, ...patch });
    },
    [establish, session],
  );

  const signOut = useCallback(() => {
    setSession(null);
    setPendingPhone(null);
    setStatus('signed_out');
    void clearSession();
  }, []);

  const value = useMemo<AuthValue>(
    () => ({
      status,
      session,
      pendingPhone: pendingPhone ?? session?.phone ?? null,
      signIn,
      signUp,
      signInWithGoogle,
      requestPasswordReset,
      verify,
      completeSetup,
      updateProfile,
      signOut,
    }),
    [
      status,
      session,
      pendingPhone,
      signIn,
      signUp,
      signInWithGoogle,
      requestPasswordReset,
      verify,
      completeSetup,
      updateProfile,
      signOut,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

function resolveStatus(session: StoredSession | null): AuthStatus {
  if (!session) return 'signed_out';
  return session.city && session.sports.length > 0 ? 'signed_in' : 'needs_setup';
}
