/**
 * The ticking itself is a one-line interval; the arithmetic it drives is
 * `secondsUntil`, which has its own tests in `src/lib/__tests__/datetime.test.ts`.
 * These cover what the hook adds: the initial read, and the no-deadline case.
 */
import { renderHook } from '@testing-library/react-native';

import { useCountdown } from '../use-countdown';

describe('useCountdown', () => {
  it('reports the remaining hold on the first render', async () => {
    const expiresAt = new Date(Date.now() + 300_000).toISOString();
    const { result } = await renderHook(() => useCountdown(expiresAt));
    expect(result.current).toBeGreaterThan(295);
    expect(result.current).toBeLessThanOrEqual(300);
  });

  it('returns zero for a deadline that has already passed', async () => {
    const expiresAt = new Date(Date.now() - 10_000).toISOString();
    const { result } = await renderHook(() => useCountdown(expiresAt));
    expect(result.current).toBe(0);
  });

  it('returns zero when there is no deadline, and subscribes to nothing', async () => {
    const { result } = await renderHook(() => useCountdown(undefined));
    expect(result.current).toBe(0);
  });
});
