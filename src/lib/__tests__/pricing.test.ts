import type { Court } from '@/domain/types';
import {
  CONVENIENCE_FEE,
  DEPOSIT_PERCENT,
  calculatePayment,
  isWithinWindow,
  resolveSlotPrice,
} from '../pricing';

const court: Court = {
  id: 'court-1',
  venueId: 'venue-1',
  name: 'Court 1',
  sport: 'padel',
  format: 'padel_doubles',
  surface: 'Artificial grass',
  indoor: true,
  basePricePerHour: 4500,
  peakRules: [{ daysOfWeek: [], from: '18:00', to: '03:00', pricePerHour: 5500 }],
};

/** PKT is UTC+5, so 21:00 in Lahore is 16:00Z. */
const pkt = (isoLocal: string) => `${isoLocal}+05:00`;

describe('isWithinWindow', () => {
  it('handles a window inside one day', () => {
    expect(isWithinWindow(10 * 60, '09:00', '17:00')).toBe(true);
    expect(isWithinWindow(8 * 60, '09:00', '17:00')).toBe(false);
    expect(isWithinWindow(17 * 60, '09:00', '17:00')).toBe(false); // end is exclusive
    expect(isWithinWindow(9 * 60, '09:00', '17:00')).toBe(true); // start is inclusive
  });

  it('handles a window that wraps past midnight, which every night rate does', () => {
    expect(isWithinWindow(21 * 60, '18:00', '03:00')).toBe(true);
    expect(isWithinWindow(1 * 60, '18:00', '03:00')).toBe(true);
    expect(isWithinWindow(4 * 60, '18:00', '03:00')).toBe(false);
    expect(isWithinWindow(12 * 60, '18:00', '03:00')).toBe(false);
  });
});

describe('resolveSlotPrice', () => {
  it('charges off-peak during the day', () => {
    expect(resolveSlotPrice(court, pkt('2026-09-02T11:00:00'))).toEqual({
      price: 4500,
      isPeak: false,
    });
  });

  it('charges peak at night', () => {
    expect(resolveSlotPrice(court, pkt('2026-09-02T21:00:00'))).toEqual({
      price: 5500,
      isPeak: true,
    });
  });

  it('still charges peak after midnight, when the court is busiest', () => {
    expect(resolveSlotPrice(court, pkt('2026-09-03T01:00:00'))).toEqual({
      price: 5500,
      isPeak: true,
    });
  });

  it('honours a weekend-only rule', () => {
    const weekendCourt: Court = {
      ...court,
      peakRules: [{ daysOfWeek: [0, 6], from: '18:00', to: '23:00', pricePerHour: 6000 }],
    };
    // 2026-09-05 is a Saturday, 2026-09-02 a Wednesday.
    expect(resolveSlotPrice(weekendCourt, pkt('2026-09-05T20:00:00')).price).toBe(6000);
    expect(resolveSlotPrice(weekendCourt, pkt('2026-09-02T20:00:00')).price).toBe(4500);
  });

  it('takes the first matching rule so specific rules can precede broad ones', () => {
    const layered: Court = {
      ...court,
      peakRules: [
        { daysOfWeek: [5], from: '20:00', to: '23:00', pricePerHour: 7500 },
        { daysOfWeek: [], from: '18:00', to: '03:00', pricePerHour: 5500 },
      ],
    };
    // 2026-09-04 is a Friday.
    expect(resolveSlotPrice(layered, pkt('2026-09-04T21:00:00')).price).toBe(7500);
    expect(resolveSlotPrice(layered, pkt('2026-09-03T21:00:00')).price).toBe(5500);
  });
});

describe('calculatePayment', () => {
  it('reproduces the Checkout frame: Rs 5,500 court, Rs 1,100 online, Rs 4,400 at venue', () => {
    const breakdown = calculatePayment(5500, 'deposit');
    expect(breakdown.dueAtVenue).toBe(4400);
    expect(breakdown.payNow).toBe(1100 + CONVENIENCE_FEE);
    expect(breakdown.total).toBe(5600);
  });

  it('collects everything up front when prepaying in full', () => {
    expect(calculatePayment(5500, 'full_prepay')).toEqual({
      total: 5600,
      courtTotal: 5500,
      convenienceFee: CONVENIENCE_FEE,
      payNow: 5600,
      dueAtVenue: 0,
    });
  });

  it('always covers the court total between the two legs', () => {
    for (const courtTotal of [450, 1350, 2500, 3333, 5500, 8000]) {
      for (const mode of ['deposit', 'full_prepay'] as const) {
        const breakdown = calculatePayment(courtTotal, mode);
        expect(breakdown.payNow + breakdown.dueAtVenue).toBe(courtTotal + CONVENIENCE_FEE);
        expect(breakdown.payNow).toBeGreaterThanOrEqual(CONVENIENCE_FEE);
      }
    }
  });

  it('rounds the deposit up, so the online leg never under-covers our fee', () => {
    const breakdown = calculatePayment(3333, 'deposit');
    expect(breakdown.payNow).toBe(Math.ceil((3333 * DEPOSIT_PERCENT) / 100) + CONVENIENCE_FEE);
    expect(breakdown.dueAtVenue).toBe(3333 - Math.ceil((3333 * DEPOSIT_PERCENT) / 100));
  });
});
