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
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ReactNode } from 'react';

import { ApiError, type AuthSession } from '@/data/api';
import { useApi } from '@/data/provider';
import type { City, CurrentPlayer, Sport } from '@/domain/types';
import { skipGates } from '@/features/dev-gates';

import { clearSession, readSession, writeSession, type StoredSession } from './storage';
import {
  clearTokens,
  onSessionLost,
  readTokens,
  toTokenPair,
  writeTokens,
} from './tokens';
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
  const api = useApi();
  /*
   * `??` would be wrong here. `initialSession` is typed `StoredSession | null`, so `null`
   * is a value — "start signed out" — not an absence, and coalescing on it would fall
   * through to the dev session or to `loading` and never resolve. Only `undefined` means
   * "not specified".
   */
  const seed = initialSession !== undefined ? initialSession : skipGates ? DEV_SESSION : undefined;
  const [status, setStatus] = useState<AuthStatus>(
    seed === undefined ? 'loading' : resolveStatus(seed),
  );
  const [session, setSession] = useState<StoredSession | null>(seed ?? null);
  const [pendingPhone, setPendingPhone] = useState<string | null>(null);

  /*
   * `signOut` is declared below, after the calls it depends on. A ref lets the listener
   * above reach the current one without the subscription tearing down and re-establishing
   * on every render.
   */
  const signOutRef = useRef<() => void>(() => {});

  const establish = useCallback((next: StoredSession) => {
    setSession(next);
    setStatus(resolveStatus(next));
    void writeSession(next);
  }, []);

  /**
   * Takes a session the server just issued: stores the tokens, then reads the account back
   * through the api so the profile comes from one place rather than being assembled from
   * whatever the sign-in request happened to carry.
   */
  const adopt = useCallback(
    async (issued: AuthSession) => {
      await writeTokens(toTokenPair(issued));
      const me = await api.currentPlayer();
      establish(toStoredSession(me));
    },
    [api, establish],
  );

  /*
   * The session ending underneath the app — a refresh token expired, revoked, or burned
   * because the server saw it twice. Without this the player sits on a screen that has
   * quietly stopped loading and has no way to understand why.
   */
  useEffect(() => onSessionLost(() => signOutRef.current()), []);

  useEffect(() => {
    if (initialSession !== undefined || skipGates) return;

    let active = true;

    void (async () => {
      const stored = await readSession();
      if (!active) return;

      // What the device remembers, shown straight away: the app opens on the last known
      // state instead of a spinner while the network is asked.
      setSession(stored);
      setStatus(resolveStatus(stored));

      const pair = await readTokens();
      if (!pair || !active) return;

      try {
        const me = await api.currentPlayer();
        if (active) establish(toStoredSession(me));
      } catch {
        // Offline, or the session is over. The first is temporary and the stored session
        // stands; the second arrives through `onSessionLost` instead.
      }
    })();

    return () => {
      active = false;
    };
  }, [api, establish, initialSession]);

  const signIn = useCallback<AuthValue['signIn']>(
    async (email, password) => {
      if (!isValidEmail(email) || !isValidPassword(password)) return 'invalid_credentials';

      try {
        // The account comes back from the server, not from what this device remembers. A
        // returning player on a new handset gets their sports and city with it, which is
        // what stops them being walked through setup a second time.
        await adopt(await api.login(email.trim(), password));
        return null;
      } catch (error) {
        return toAuthError(error);
      }
    },
    [adopt, api],
  );

  const signUp = useCallback<AuthValue['signUp']>(
    async ({ fullName, email, phone, password }) => {
      if (!isValidEmail(email)) return 'invalid_credentials';
      if (!isValidPassword(password)) return 'weak_password';

      const international = `+92${normalisePhone(phone)}`;
      setPendingPhone(international);

      try {
        await adopt(
          await api.register({
            fullName: fullName.trim(),
            email: email.trim(),
            phone: international,
            password,
          }),
        );
        return null;
      } catch (error) {
        return toAuthError(error);
      }
    },
    [adopt, api],
  );

  const requestPasswordReset = useCallback<AuthValue['requestPasswordReset']>(async (email) => {
    return isValidEmail(email) ? null : 'invalid_credentials';
  }, []);

  const verify = useCallback(async (code: string) => code.length === OTP_LENGTH, []);

  const completeSetup = useCallback(
    (sports: string[], city: string) => {
      if (!session) return;
      // Written locally first so the gate opens on the tap rather than on the round trip.
      // The server is still the record: a failure here leaves the phone ahead of it, and
      // the next `currentPlayer` read corrects the phone rather than the other way round.
      establish({ ...session, sports, city });
      void api
        .updateProfile({ sports: sports as Sport[], city: city as City })
        .catch(() => undefined);
    },
    [api, establish, session],
  );

  const updateProfile = useCallback<AuthValue['updateProfile']>(
    (patch) => {
      if (!session) return;
      establish({ ...session, ...patch });
      if (patch.fullName !== undefined) {
        void api.updateProfile({ fullName: patch.fullName }).catch(() => undefined);
      }
    },
    [api, establish, session],
  );

  const signOut = useCallback(() => {
    setSession(null);
    setPendingPhone(null);
    setStatus('signed_out');
    void clearSession();

    // Local state is cleared first and unconditionally. Ending the session on the server is
    // the right thing to do and it is allowed to fail — a player on a dead connection who
    // taps sign out must still be signed out.
    void readTokens().then((pair) => {
      void clearTokens();
      if (pair) void api.signOut(pair.refreshToken).catch(() => undefined);
    });
  }, [api]);

  signOutRef.current = signOut;

  const value = useMemo<AuthValue>(
    () => ({
      status,
      session,
      pendingPhone: pendingPhone ?? session?.phone ?? null,
      signIn,
      signUp,
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
      requestPasswordReset,
      verify,
      completeSetup,
      updateProfile,
      signOut,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** `CurrentPlayer` is what the server calls an account; `StoredSession` is what the app does. */
function toStoredSession(me: CurrentPlayer): StoredSession {
  return {
    id: me.id,
    fullName: me.name,
    email: me.email ?? '',
    phone: me.phone ?? '',
    sports: me.sports,
    city: me.city,
    ownedVenueIds: me.ownedVenueIds,
  };
}

/**
 * Server codes to the ones the sign-in screens already show.
 *
 * A network failure is deliberately not `invalid_credentials`: telling someone on a dropped
 * connection that their password is wrong sends them to reset a password that was fine.
 */
function toAuthError(error: unknown): AuthError {
  if (error instanceof ApiError) {
    if (error.code === 'already_registered') return 'email_taken';
    if (error.code === 'network') return 'network';
  }
  return 'invalid_credentials';
}

function resolveStatus(session: StoredSession | null): AuthStatus {
  if (!session) return 'signed_out';
  return session.city && session.sports.length > 0 ? 'signed_in' : 'needs_setup';
}
