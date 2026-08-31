/**
 * Session persistence.
 *
 * Reads are defensive: a storage failure must land the user at sign-in, not lock them out
 * of the app, and a failed write only costs them a re-login.
 *
 * No password is ever stored here. Sign-in exchanges credentials for a session; the
 * password does not outlive the request, and the real backend will return a token that
 * replaces `id` when it lands.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const SESSION_KEY = 'maidan.auth.session';

/**
 * Bump when `StoredSession` changes shape.
 *
 * Without this, a record written by an older build still parses as JSON and is read as a
 * valid session with fields silently missing — which is how a signed-in user ends up with
 * no email and no id. A version mismatch is treated as no session: signing in again is a
 * far smaller cost than a half-populated account.
 *
 * v2 added `ownedVenueIds`; a v1 record would have left an owner unable to reach their own
 * dashboard, so it is discarded rather than read.
 */
const SESSION_VERSION = 2;

interface Envelope {
  version: number;
  session: StoredSession;
}

export interface StoredSession {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  /** Sports the player picked during setup. Empty until they choose. */
  sports: string[];
  city: string | null;
  /**
   * Venues this account manages. Empty for an ordinary player.
   *
   * An account can be both — an owner books courts elsewhere like anyone else — so this is
   * a list rather than a role flag. The real backend returns it with the session.
   */
  ownedVenueIds: string[];
}

export async function readSession(): Promise<StoredSession | null> {
  try {
    const raw = await AsyncStorage.getItem(SESSION_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<Envelope>;
    if (parsed?.version !== SESSION_VERSION || !parsed.session) {
      await clearSession();
      return null;
    }
    return parsed.session;
  } catch {
    return null;
  }
}

export async function writeSession(session: StoredSession): Promise<void> {
  try {
    const envelope: Envelope = { version: SESSION_VERSION, session };
    await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(envelope));
  } catch {
    // The user signs in again next launch. Annoying, never blocking.
  }
}

export async function clearSession(): Promise<void> {
  try {
    await AsyncStorage.removeItem(SESSION_KEY);
  } catch {
    // Nothing useful to do; the session simply outlives the sign-out.
  }
}
