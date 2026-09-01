/**
 * What the HTTP client does when a token stops working.
 *
 * The case worth pinning is the concurrent one. Refresh tokens rotate, and the server
 * treats a token presented twice as evidence that it leaked — it revokes the whole family.
 * A screen that fires several queries on mount would otherwise hit several 401s, start
 * several refreshes with the same token, and sign the player out for doing nothing wrong.
 * That failure is invisible in development, where one request is usually in flight at a
 * time, and reliable on a phone that has just come back onto a signal.
 */
import { ApiError } from '../api';
import { createHttpApi, type TokenProvider } from '../http-api';

const BASE = 'https://api.test';

function jsonResponse(status: number, body: unknown): Response {
  return {
    status,
    ok: status >= 200 && status < 300,
    text: async () => JSON.stringify(body),
  } as Response;
}

const UNAUTHORIZED = { error: { code: 'unauthorized', message: 'Sign in to continue' } };

describe('createHttpApi', () => {
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  it('sends the access token as a bearer header', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, []));
    const tokens: TokenProvider = {
      getAccessToken: async () => 'access-1',
      refresh: async () => null,
    };

    await createHttpApi({ baseUrl: BASE, tokens }).listVenues();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][1].headers.authorization).toBe('Bearer access-1');
  });

  it('refreshes once and retries after a 401', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(401, UNAUTHORIZED))
      .mockResolvedValueOnce(jsonResponse(200, []));

    const refresh = jest.fn(async () => 'access-2');
    await createHttpApi({
      baseUrl: BASE,
      tokens: { getAccessToken: async () => 'stale', refresh },
    }).listVenues();

    expect(refresh).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][1].headers.authorization).toBe('Bearer access-2');
  });

  it('refreshes only once when several requests are unauthorised at the same moment', async () => {
    // The whole reason this test exists: a second refresh with the same rotating token
    // looks like a stolen one to the server, and it revokes the family.
    fetchMock.mockImplementation(async (_url: string, init: RequestInit) => {
      const header = (init.headers as Record<string, string>).authorization;
      return header === 'Bearer fresh' ? jsonResponse(200, []) : jsonResponse(401, UNAUTHORIZED);
    });

    let refreshes = 0;
    const refresh = jest.fn(async () => {
      refreshes += 1;
      // A real refresh is a network call; the delay is what opens the window for a second.
      await new Promise((resolve) => setTimeout(resolve, 10));
      return 'fresh';
    });

    const api = createHttpApi({
      baseUrl: BASE,
      tokens: { getAccessToken: async () => 'stale', refresh },
    });

    await Promise.all([api.listVenues(), api.listBookings(), api.listTeams(), api.listThreads()]);

    expect(refreshes).toBe(1);
  });

  it('reports the session as over when the refresh fails', async () => {
    fetchMock.mockResolvedValue(jsonResponse(401, UNAUTHORIZED));
    const onSignedOut = jest.fn();

    const api = createHttpApi({
      baseUrl: BASE,
      tokens: { getAccessToken: async () => 'stale', refresh: async () => null, onSignedOut },
    });

    await expect(api.listVenues()).rejects.toThrow(ApiError);
    expect(onSignedOut).toHaveBeenCalledTimes(1);
    // One attempt, no retry: there was no new token to retry with.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not retry a request that failed for any other reason', async () => {
    // Retrying blind would replay writes. Only the booking path carries an intent id.
    fetchMock.mockResolvedValue(
      jsonResponse(409, { error: { code: 'slot_taken', message: 'Gone' } }),
    );
    const refresh = jest.fn(async () => 'fresh');

    const api = createHttpApi({
      baseUrl: BASE,
      tokens: { getAccessToken: async () => 'access-1', refresh },
    });

    await expect(api.listVenues()).rejects.toMatchObject({ code: 'slot_taken' });
    expect(refresh).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
