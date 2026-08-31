/**
 * Signing in only proves who you are. A player returning on a new device has no sports and
 * no city stored, so the session lands in `needs_setup` — and the root guard keeps them
 * inside the auth group. Without this redirect the SIGN IN button succeeds, shows no error,
 * and leaves them staring at the form they just filled in. The app is unusable from there.
 */
import { render, screen, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { AuthProvider } from '@/features/auth/context';
import { Providers } from '@/test-utils';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
  removeItem: jest.fn(() => Promise.resolve()),
}));

// `mock`-prefixed so jest's module factory may close over them.
const mockReplace = jest.fn();

jest.mock('expo-router', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View } = require('react-native');
  return {
    useRouter: () => ({ replace: mockReplace, back: jest.fn(), push: jest.fn() }),
    Link: ({ children }: { children: ReactNode }) => <View>{children}</View>,
  };
});

// eslint-disable-next-line @typescript-eslint/no-require-imports
const SignInScreen = require('../sign-in').default;

const RETURNING = {
  id: 'player-self',
  fullName: 'Umer Farhan',
  email: 'umer@maidan.pk',
  phone: '+923001234567',
  ownedVenueIds: [],
  sports: [],
  city: null,
};

function renderSignIn(initialSession: Parameters<typeof AuthProvider>[0]['initialSession']) {
  return render(
    <Providers>
      <AuthProvider initialSession={initialSession}>
        <SignInScreen />
      </AuthProvider>
    </Providers>,
  );
}

beforeEach(() => mockReplace.mockClear());

it('carries a signed-in player with no setup on to choosing sports', async () => {
  await renderSignIn(RETURNING);

  await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/(auth)/select-sports'));
});

it('leaves a signed-out player on the form', async () => {
  await renderSignIn(null);

  await waitFor(() => expect(screen.getByTestId('sign-in')).toBeTruthy());
  expect(mockReplace).not.toHaveBeenCalled();
});

it('offers no back control: sign-in is the root of the signed-out app', async () => {
  await renderSignIn(null);

  expect(screen.queryByTestId('app-bar-back')).toBeNull();
});
