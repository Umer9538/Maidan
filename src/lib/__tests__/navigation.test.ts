/**
 * The bug this pins: `router.back()` on the first screen in the stack closes the app.
 * That happens on any deep link, any notification tap, and anything reached after a
 * `replace()` — and to a player it reads as a crash.
 */
import { renderHook } from '@testing-library/react-native';

const mockBack = jest.fn();
const mockReplace = jest.fn();
let mockCanGoBack = true;

jest.mock('expo-router', () => ({
  useRouter: () => ({
    back: mockBack,
    replace: mockReplace,
    canGoBack: () => mockCanGoBack,
  }),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { useGoBack } = require('../navigation') as typeof import('../navigation');

describe('useGoBack', () => {
  beforeEach(() => {
    mockBack.mockClear();
    mockReplace.mockClear();
  });

  it('pops the stack when there is history', async () => {
    mockCanGoBack = true;
    const { result } = await renderHook(() => useGoBack('/grounds'));

    result.current();

    expect(mockBack).toHaveBeenCalledTimes(1);
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('goes to the parent instead of closing the app when there is none', async () => {
    mockCanGoBack = false;
    const { result } = await renderHook(() => useGoBack('/grounds'));

    result.current();

    expect(mockBack).not.toHaveBeenCalled();
    expect(mockReplace).toHaveBeenCalledWith('/grounds');
  });

  it('sends each screen to its own parent, not one shared home', async () => {
    mockCanGoBack = false;

    const booking = await renderHook(() => useGoBack('/bookings'));
    booking.result.current();
    expect(mockReplace).toHaveBeenLastCalledWith('/bookings');

    const chat = await renderHook(() => useGoBack('/(tabs)/chats'));
    chat.result.current();
    expect(mockReplace).toHaveBeenLastCalledWith('/(tabs)/chats');
  });
});
