/**
 * Sign-in through the API seam.
 *
 * The behaviour worth pinning is where the account comes from. It used to be assembled from
 * whatever the sign-in form carried plus whatever the device already remembered, which
 * meant a player signing in on a new handset arrived with no sports and no city and was
 * walked back through setup they had finished months ago. It now comes from the server.
 */
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { ApiError, type MaidanApi } from '@/data/api';
import { DataProvider, createQueryClient } from '@/data/provider';
import type { CurrentPlayer } from '@/domain/types';

import { AuthProvider, useAuth } from '../context';
import { readTokens } from '../tokens';

const ACCOUNT: CurrentPlayer = {
  id: 'player-self',
  name: 'Umer Farhan',
  avatarUrl: null,
  reliability: 96,
  gamesPlayed: 34,
  skillBySport: {},
  email: 'umer@maidan.pk',
  phone: '+923001234567',
  sports: ['padel', 'futsal'],
  city: 'lahore',
  ownedVenueIds: [],
  isAdmin: false,
};

function apiWith(overrides: Partial<MaidanApi>): MaidanApi {
  return {
    login: async () => ({
      accessToken: 'access',
      refreshToken: 'refresh',
      expiresIn: 900,
      playerId: 'player-self',
    }),
    currentPlayer: async () => ACCOUNT,
    ...overrides,
  } as MaidanApi;
}

function wrapper(api: MaidanApi) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <DataProvider api={api} queryClient={createQueryClient()}>
        <AuthProvider initialSession={null}>{children}</AuthProvider>
      </DataProvider>
    );
  };
}

describe('signIn', () => {
  it('takes the account from the server, not from the form', async () => {
    const { result } = await renderHook(() => useAuth(), { wrapper: wrapper(apiWith({})) });

    await act(async () => {
      expect(await result.current.signIn('umer@maidan.pk', 'hunter2pass')).toBeNull();
    });

    // Sports and city came back with the account, so setup is already done and the gate
    // opens straight into the app.
    await waitFor(() => expect(result.current.status).toBe('signed_in'));
    expect(result.current.session?.sports).toEqual(['padel', 'futsal']);
    expect(result.current.session?.city).toBe('lahore');
    expect(result.current.session?.fullName).toBe('Umer Farhan');
  });

  it('stores the tokens so later requests carry one', async () => {
    const { result } = await renderHook(() => useAuth(), { wrapper: wrapper(apiWith({})) });

    await act(async () => {
      await result.current.signIn('umer@maidan.pk', 'hunter2pass');
    });

    await waitFor(async () => expect((await readTokens())?.accessToken).toBe('access'));
  });

  it('sends a player with no sports to setup rather than into the app', async () => {
    const api = apiWith({
      currentPlayer: async () => ({ ...ACCOUNT, sports: [], city: null }),
    });
    const { result } = await renderHook(() => useAuth(), { wrapper: wrapper(api) });

    await act(async () => {
      await result.current.signIn('umer@maidan.pk', 'hunter2pass');
    });

    await waitFor(() => expect(result.current.status).toBe('needs_setup'));
  });

  it('reports a dropped connection as a network failure, not a wrong password', async () => {
    // Telling someone on a bad signal that their password is wrong sends them off to reset
    // a password that was never the problem.
    const api = apiWith({
      login: async () => {
        throw new ApiError('network', 'Could not reach Maidan.');
      },
    });
    const { result } = await renderHook(() => useAuth(), { wrapper: wrapper(api) });

    await act(async () => {
      expect(await result.current.signIn('umer@maidan.pk', 'hunter2pass')).toBe('network');
    });

    expect(result.current.status).toBe('signed_out');
  });

  it('reports a taken email as such when registering', async () => {
    const api = apiWith({
      register: async () => {
        throw new ApiError('already_registered', 'That email already has an account');
      },
    });
    const { result } = await renderHook(() => useAuth(), { wrapper: wrapper(api) });

    await act(async () => {
      const error = await result.current.signUp({
        fullName: 'Umer',
        email: 'umer@maidan.pk',
        phone: '3001234567',
        password: 'hunter2pass',
      });
      expect(error).toBe('email_taken');
    });
  });

  it('refuses a malformed email without calling the server', async () => {
    const login = jest.fn();
    const { result } = await renderHook(() => useAuth(), { wrapper: wrapper(apiWith({ login })) });

    await act(async () => {
      expect(await result.current.signIn('not-an-email', 'hunter2pass')).toBe(
        'invalid_credentials',
      );
    });

    expect(login).not.toHaveBeenCalled();
  });
});

describe('signOut', () => {
  it('clears the local session even when the server call fails', async () => {
    // Someone on a dead connection who taps sign out must still be signed out.
    const api = apiWith({
      signOut: async () => {
        throw new ApiError('network', 'Could not reach Maidan.');
      },
    });
    const { result } = await renderHook(() => useAuth(), { wrapper: wrapper(api) });

    await act(async () => {
      await result.current.signIn('umer@maidan.pk', 'hunter2pass');
    });
    await waitFor(() => expect(result.current.status).toBe('signed_in'));

    await act(async () => result.current.signOut());

    expect(result.current.status).toBe('signed_out');
    expect(result.current.session).toBeNull();
    await waitFor(async () => expect(await readTokens()).toBeNull());
  });
});
