/**
 * The owner's hub, and the gate it has to make legible.
 *
 * A ground under review cannot be booked — not in the app and not at the owner's own
 * counter. The screen's job is to say where a listing stands and offer only the controls
 * that would actually work, because a "Go live" button on a venue still in review can only
 * fail, and an owner who taps it learns nothing except that the app is broken.
 */
import { screen, waitFor } from '@testing-library/react-native';

import { createMockApi } from '@/data/mock-api';
import type { MaidanApi } from '@/data/api';
import type { Venue } from '@/domain/types';
import { renderScreen } from '@/test-utils';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => true }),
  useFocusEffect: jest.fn(),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const MyVenuesScreen = require('../venues').default;

const BASE: Venue = {
  id: 'venue-mine',
  ownerId: 'player-self',
  name: 'DHA Padel Club',
  city: 'lahore',
  area: 'DHA Phase 6',
  geo: { latitude: 31.47, longitude: 74.41 },
  sports: ['padel'],
  amenities: [],
  photos: [],
  about: '',
  hours: { opensAt: '09:00', closesAt: '03:00' },
  fromPricePerHour: 2800,
  phone: '',
  rating: null,
  reviewCount: 0,
  playerCount: 0,
  status: 'pending',
  reviewNote: null,
  cancellationPolicyId: 'standard',
};

function apiShowing(venue: Venue): MaidanApi {
  const api = createMockApi({ latencyMs: 0 });
  return { ...api, listMyVenues: async () => [venue] };
}

it('says a ground in review cannot be booked yet, and offers nothing to press', async () => {
  await renderScreen(<MyVenuesScreen />, { api: apiShowing(BASE) });

  await waitFor(() => expect(screen.getByText('In review')).toBeTruthy());
  expect(screen.getByText(/Nothing can be booked yet/)).toBeTruthy();
  // The only thing that would work is entering courts, which can be done while waiting.
  expect(screen.queryByTestId('publish-venue-mine')).toBeNull();
  expect(screen.getByTestId('courts-venue-mine')).toBeTruthy();
});

it('shows the reviewer\'s own words when a ground is sent back', async () => {
  const rejected = { ...BASE, status: 'rejected' as const, reviewNote: 'Send a utility bill.' };
  await renderScreen(<MyVenuesScreen />, { api: apiShowing(rejected) });

  await waitFor(() => expect(screen.getByText('Needs changes')).toBeTruthy());
  // Without the note the owner has a dead listing and nothing to act on.
  expect(screen.getByText('Send a utility bill.')).toBeTruthy();
});

it('offers Go live only once the ground is approved', async () => {
  const approved = { ...BASE, status: 'verified' as const };
  await renderScreen(<MyVenuesScreen />, { api: apiShowing(approved) });

  await waitFor(() => expect(screen.getByText('Approved')).toBeTruthy());
  expect(screen.getByTestId('publish-venue-mine')).toBeTruthy();
});

it('offers pausing, not publishing, once it is live', async () => {
  const live = { ...BASE, status: 'live' as const };
  await renderScreen(<MyVenuesScreen />, { api: apiShowing(live) });

  await waitFor(() => expect(screen.getByText('Live')).toBeTruthy());
  expect(screen.getByTestId('unpublish-venue-mine')).toBeTruthy();
  expect(screen.queryByTestId('publish-venue-mine')).toBeNull();
});

it('points an owner with no grounds at registering one', async () => {
  const api = createMockApi({ latencyMs: 0 });
  await renderScreen(<MyVenuesScreen />, {
    api: { ...api, listMyVenues: async () => [] } as MaidanApi,
  });

  await waitFor(() => expect(screen.getByTestId('no-venues')).toBeTruthy());
});
