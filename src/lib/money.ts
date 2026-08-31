/**
 * Money helpers. All amounts are whole rupees (see `Rupees` in @/domain/types).
 */
import type { Rupees } from '@/domain/types';

/** `5500` -> `Rs 5,500`. Grouping is written out because Hermes' `Intl` is not guaranteed. */
export function formatPkr(amount: Rupees): string {
  const rounded = Math.round(amount);
  const sign = rounded < 0 ? '-' : '';
  const digits = Math.abs(rounded).toString();
  let grouped = '';
  for (let i = 0; i < digits.length; i += 1) {
    if (i > 0 && (digits.length - i) % 3 === 0) grouped += ',';
    grouped += digits[i];
  }
  return `${sign}Rs ${grouped}`;
}

/** `5500` -> `Rs 5,500/hr`. */
export function formatPkrPerHour(amount: Rupees): string {
  return `${formatPkr(amount)}/hr`;
}

/**
 * Divides a booking between players so the shares sum to exactly the total.
 *
 * An even split rarely divides cleanly (Rs 5,000 across 3 players is not a whole
 * number), and quietly rounding each share would either short the venue or overcharge
 * the group. The remainder is spread one rupee at a time across the earliest shares,
 * so the sum is always exact and no share differs from another by more than Re 1.
 */
export function splitEvenly(total: Rupees, ways: number): Rupees[] {
  if (!Number.isInteger(ways) || ways < 1) {
    throw new RangeError(`Cannot split a booking ${ways} ways`);
  }
  const base = Math.floor(total / ways);
  const remainder = total - base * ways;
  return Array.from({ length: ways }, (_, index) => base + (index < remainder ? 1 : 0));
}

/**
 * The per-player figure shown on a match card, before anyone has joined.
 * Rounded up so the advertised price is never less than what a player will owe.
 */
export function perPlayerShare(total: Rupees, ways: number): Rupees {
  if (!Number.isInteger(ways) || ways < 1) {
    throw new RangeError(`Cannot split a booking ${ways} ways`);
  }
  return Math.ceil(total / ways);
}
