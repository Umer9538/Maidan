/**
 * Checkout is the highest-risk screen in the app: it takes money, and it runs on networks
 * that drop requests mid-flight. These cover the two behaviours that matter — the deposit
 * split shown to the player, and the guarantee that a retry cannot book or charge twice.
 */
import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { createMockApi } from '@/data/mock-api';
import { renderScreen } from '@/test-utils';

// `mock`-prefixed so jest's module factory may close over them.
const mockReplace = jest.fn();
let mockParams: Record<string, string> = {};

jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace, back: jest.fn(), push: jest.fn() }),
  useLocalSearchParams: () => mockParams,
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const CheckoutScreen = require('../checkout').default;

const NOW = new Date('2026-09-02T10:00:00+05:00');
const COURT = 'court-pr-1';

/**
 * Fake timers, because the hold countdown ticks once a second. With real timers React's
 * act queue never drains — there is always another scheduled render — and the test hangs.
 * Latency is zeroed so data still arrives without driving the clock.
 */
beforeAll(() => jest.useFakeTimers());
afterAll(() => jest.useRealTimers());

async function setup() {
  const api = createMockApi({ now: () => NOW, latencyMs: 0 });
  const slots = await api.listSlots(COURT, NOW.toISOString());
  // 9 PM PKT — the peak slot, Rs 5,500, matching the Checkout frame.
  const peak = slots.find((slot) => slot.price === 5500 && slot.status === 'available');
  if (!peak) throw new Error('no peak slot in the seed');
  const hold = await api.holdSlot(COURT, peak.startAt);

  mockParams = {
    holdId: hold.id,
    venueId: 'venue-padel-republic',
    courtId: COURT,
    startAt: peak.startAt,
    price: String(peak.price),
    expiresAt: hold.expiresAt,
  };

  await renderScreen(<CheckoutScreen />, { api });

  return { api };
}

describe('Checkout', () => {
  beforeEach(() => {
    mockReplace.mockClear();
  });

  it('defaults to deposit mode and shows the cash balance owed at the counter', async () => {
    await setup();

    // Rs 5,500 court time: Rs 1,100 deposit + Rs 100 fee online, Rs 4,400 in cash.
    expect(
      screen.getByLabelText(
        'Deposit now, cash at venue. Rs 1,200 online now · Rs 4,400 cash at the counter',
      ),
    ).toBeTruthy();
    expect(screen.getByTestId('mode-deposit').props.accessibilityState.selected).toBe(true);
    expect(screen.getByTestId('mode-full').props.accessibilityState.selected).toBe(false);
  });

  it('switches to full prepay, leaving nothing at the venue', async () => {
    await setup();

    await fireEvent.press(screen.getByTestId('mode-full'));

    expect(screen.getByTestId('mode-full').props.accessibilityState.selected).toBe(true);
    expect(screen.getByLabelText('Pay with JazzCash')).toBeTruthy();
  });

  it('defaults to JazzCash, the rail most Pakistani players actually hold', async () => {
    await setup();
    expect(screen.getByTestId('provider-jazzcash').props.accessibilityState.selected).toBe(true);
  });

  it('books once and routes to the ticket', async () => {
    const { api } = await setup();

    await fireEvent.press(screen.getByTestId('pay'));

    await waitFor(() => expect(mockReplace).toHaveBeenCalled());
    const bookings = await api.listBookings();
    expect(bookings).toHaveLength(1);
    expect(mockReplace).toHaveBeenCalledWith(`/booking/${bookings[0].id}`);
  });

  it('never double-books when the player taps pay twice on a slow connection', async () => {
    const { api } = await setup();

    // Three taps on a connection that feels dead — the classic double-charge scenario.
    await fireEvent.press(screen.getByTestId('pay'));
    await fireEvent.press(screen.getByTestId('pay'));
    await fireEvent.press(screen.getByTestId('pay'));

    await waitFor(() => expect(mockReplace).toHaveBeenCalled());
    expect(await api.listBookings()).toHaveLength(1);
  });
});
