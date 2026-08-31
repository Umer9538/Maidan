/**
 * Booking intent ids.
 *
 * Generated on the client and held stable across retries: on a flaky connection a user
 * will tap "pay" again, and the server must recognise the second attempt as the same
 * booking rather than making — and charging for — a new one (docs/05 §5.1).
 */
export function createIntentId(): string {
  const random = Math.random().toString(36).slice(2, 12);
  return `intent-${Date.now().toString(36)}-${random}`;
}
