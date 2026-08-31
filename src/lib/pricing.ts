/**
 * Slot pricing and the deposit split.
 *
 * Night play is peak in Pakistan — the heat pushes demand to 6 PM-3 AM — so peak
 * windows routinely wrap past midnight and the comparison has to handle that.
 */
import type { Court, PaymentMode, PeakRule, Rupees, Timestamp } from '@/domain/types';
import { parseClock, toPkt } from './datetime';

/**
 * Share of the booking taken online in deposit mode.
 *
 * Small enough that a cash-first player will still pay it, large enough to make a
 * no-show cost something. docs/03 §2.3.
 */
export const DEPOSIT_PERCENT = 20;

/** Flat per-booking fee — the MVP revenue stream. docs/03 §2.2. */
export const CONVENIENCE_FEE: Rupees = 100;

/** True when the local clock at `minutes` falls inside a rule that may wrap past midnight. */
export function isWithinWindow(minutes: number, from: string, to: string): boolean {
  const start = parseClock(from);
  const end = parseClock(to);
  return start <= end
    ? minutes >= start && minutes < end
    : // Wraps midnight: 18:00-03:00 covers both the evening and the small hours.
      minutes >= start || minutes < end;
}

function ruleApplies(rule: PeakRule, startAt: Timestamp): boolean {
  const { weekday, hour, minute } = toPkt(startAt);
  const matchesDay = rule.daysOfWeek.length === 0 || rule.daysOfWeek.includes(weekday);
  return matchesDay && isWithinWindow(hour * 60 + minute, rule.from, rule.to);
}

export interface SlotPrice {
  price: Rupees;
  isPeak: boolean;
}

/**
 * Resolves what one hour on this court costs at `startAt`.
 * The first matching peak rule wins, so owners can order specific rules before broad ones.
 */
export function resolveSlotPrice(court: Court, startAt: Timestamp): SlotPrice {
  const rule = court.peakRules.find((candidate) => ruleApplies(candidate, startAt));
  return rule
    ? { price: rule.pricePerHour, isPeak: true }
    : { price: court.basePricePerHour, isPeak: false };
}

export interface PaymentBreakdown {
  /** Court time plus the convenience fee. */
  total: Rupees;
  courtTotal: Rupees;
  convenienceFee: Rupees;
  /** Collected through the gateway now. */
  payNow: Rupees;
  /** Cash at the counter. Zero when prepaying in full. */
  dueAtVenue: Rupees;
}

/**
 * Splits a booking into what is collected online and what is owed at the venue.
 *
 * The convenience fee always rides on the online portion: it is our revenue, and it is
 * the one part of the booking a venue never handles cash for. The deposit is rounded up
 * so the online leg can never under-cover the fee.
 */
export function calculatePayment(courtTotal: Rupees, mode: PaymentMode): PaymentBreakdown {
  const total = courtTotal + CONVENIENCE_FEE;

  if (mode === 'full_prepay') {
    return { total, courtTotal, convenienceFee: CONVENIENCE_FEE, payNow: total, dueAtVenue: 0 };
  }

  const deposit = Math.ceil((courtTotal * DEPOSIT_PERCENT) / 100);
  return {
    total,
    courtTotal,
    convenienceFee: CONVENIENCE_FEE,
    payNow: deposit + CONVENIENCE_FEE,
    dueAtVenue: courtTotal - deposit,
  };
}
