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

/**
 * The token side of the HTTP client's contract.
 *
 * Refresh is a bare `fetch` rather than a call back through `MaidanApi`, and deliberately
 * so: the api is built *with* this provider, and routing refresh through it would close a
 * loop between the two. Refresh is a transport concern anyway — it renews the credential
 * the transport carries, and no screen ever asks for it.
 */
export interface SessionLostListener {
  (): void;
}

const listeners = new Set<SessionLostListener>();

/**
 * Called when a session cannot be recovered — the refresh token is expired, revoked, or was
 * burned because the server saw it twice. The auth context listens so the player lands on
 * sign-in rather than on a screen that has quietly stopped loading.
 */
export function onSessionLost(listener: SessionLostListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function announceSessionLost(): void {
  for (const listener of listeners) listener();
}

export function createTokenProvider(baseUrl: string) {
  return {
    async getAccessToken(): Promise<string | null> {
      const pair = await readTokens();
      if (!pair) return null;
      // Expired tokens are still handed over. The 401 that follows is what triggers the
      // shared refresh, and returning null here would instead send an unauthenticated
      // request that the server cannot tell apart from a signed-out one.
      return pair.accessToken;
    },

    async refresh(): Promise<string | null> {
      const pair = await readTokens();
      if (!pair) return null;

      try {
        const response = await fetch(`${baseUrl}/auth/refresh`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ refreshToken: pair.refreshToken }),
        });

        if (!response.ok) {
          // The session is over rather than merely stale, so the stored pair is worse than
          // useless: keeping it would make every launch retry a token the server has
          // already refused.
          await clearTokens();
          return null;
        }

        const session = (await response.json()) as {
          accessToken: string;
          refreshToken: string;
          expiresIn: number;
        };
        await writeTokens(toTokenPair(session));
        return session.accessToken;
      } catch {
        // A dropped connection is not a lost session. The tokens stay; the request fails
        // as a network error and the next attempt can succeed.
        return null;
      }
    },

    onSignedOut: announceSessionLost,
  };
}
