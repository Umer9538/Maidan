/**
 * The bearer token pair, and where it lives.
 *
 * Kept apart from `storage.ts` deliberately. That file holds who the player is — a profile
 * the app reads on every screen. This holds a credential: it is written and read only by
 * the HTTP client, and clearing it must not take the profile with it.
 *
 * Reads are defensive for the same reason as the session's: a storage failure should land
 * the player at sign-in, not wedge the app.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const TOKENS_KEY = 'maidan.auth.tokens';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  /** Epoch milliseconds. Derived from the server's `expiresIn` at the moment it replied. */
  expiresAt: number;
}

/**
 * Treated as expired this long before it actually is.
 *
 * A token with four seconds left passes a naive check and then fails at the server,
 * because the request still has to cross a Pakistani mobile network. Refreshing early
 * costs one extra call; not doing it costs a spurious sign-out.
 */
const EXPIRY_MARGIN_MS = 30_000;

export function isExpired(pair: TokenPair, now = Date.now()): boolean {
  return pair.expiresAt - EXPIRY_MARGIN_MS <= now;
}

/** Builds a pair from what `/auth/login` and friends return. */
export function toTokenPair(
  session: { accessToken: string; refreshToken: string; expiresIn: number },
  now = Date.now(),
): TokenPair {
  return {
    accessToken: session.accessToken,
    refreshToken: session.refreshToken,
    expiresAt: now + session.expiresIn * 1000,
  };
}

export async function readTokens(): Promise<TokenPair | null> {
  try {
    const raw = await AsyncStorage.getItem(TOKENS_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<TokenPair>;
    if (
      typeof parsed.accessToken !== 'string' ||
      typeof parsed.refreshToken !== 'string' ||
      typeof parsed.expiresAt !== 'number'
    ) {
      // A half-written or older record. Discarded rather than half-trusted: a pair missing
      // its refresh token would sign the player out at the first expiry with no way back.
      return null;
    }

    return parsed as TokenPair;
  } catch {
    return null;
  }
}

export async function writeTokens(pair: TokenPair): Promise<void> {
  try {
    await AsyncStorage.setItem(TOKENS_KEY, JSON.stringify(pair));
  } catch {
    // Costs a re-login on next launch, which is better than failing the sign-in that just
    // succeeded.
  }
}

export async function clearTokens(): Promise<void> {
  try {
    await AsyncStorage.removeItem(TOKENS_KEY);
  } catch {
    // Nothing useful to do. The tokens are already unusable by the time this is called.
  }
}
