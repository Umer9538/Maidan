import type { CancellationPolicy } from '@/domain/types';
import { describePolicy, resolveRefund } from '../cancellation';

const policy: CancellationPolicy = {
  id: 'standard',
  label: 'Standard',
  tiers: [
    { hoursBefore: 6, refundPercent: 100 },
    { hoursBefore: 2, refundPercent: 50 },
    { hoursBefore: 0, refundPercent: 0 },
  ],
};

const booking = {
  paidOnline: 1100,
  startAt: '2026-09-02T21:00:00+05:00',
  cancellationPolicy: policy,
};

const at = (isoLocal: string) => new Date(`${isoLocal}+05:00`);

describe('resolveRefund', () => {
  it('refunds in full well before the slot', () => {
    expect(resolveRefund(booking, at('2026-09-02T10:00:00'))).toMatchObject({
      refundPercent: 100,
      refundAmount: 1100,
    });
  });

  it('refunds half inside the 6h window', () => {
    expect(resolveRefund(booking, at('2026-09-02T17:00:00'))).toMatchObject({
      refundPercent: 50,
      refundAmount: 550,
    });
  });

  it('refunds nothing inside the 2h window', () => {
    expect(resolveRefund(booking, at('2026-09-02T20:00:00'))).toMatchObject({
      refundPercent: 0,
      refundAmount: 0,
    });
  });

  it('treats the tier boundary as still inside the more generous tier', () => {
    expect(resolveRefund(booking, at('2026-09-02T15:00:00')).refundPercent).toBe(100);
  });

  it('refunds nothing once the slot has started', () => {
    expect(resolveRefund(booking, at('2026-09-02T22:00:00')).refundPercent).toBe(0);
  });

  it('reads tiers widest-first, not in authored order', () => {
    const shuffled: CancellationPolicy = { ...policy, tiers: [...policy.tiers].reverse() };
    expect(
      resolveRefund({ ...booking, cancellationPolicy: shuffled }, at('2026-09-02T10:00:00'))
        .refundPercent,
    ).toBe(100);
  });

  it('never refunds more than we collected online — cash at the venue is not ours', () => {
    const cashHeavy = { ...booking, paidOnline: 0 };
    expect(resolveRefund(cashHeavy, at('2026-09-02T10:00:00')).refundAmount).toBe(0);
  });

  it('rounds a part refund down to a whole rupee', () => {
    const odd = { ...booking, paidOnline: 667 };
    expect(resolveRefund(odd, at('2026-09-02T17:00:00')).refundAmount).toBe(333);
  });

  it('applies the snapshotted policy, not a newer one', () => {
    const stricter: CancellationPolicy = {
      id: 'strict',
      label: 'Strict',
      tiers: [{ hoursBefore: 48, refundPercent: 100 }],
    };
    // The booking still carries the policy it was made under.
    expect(resolveRefund(booking, at('2026-09-02T10:00:00')).refundPercent).toBe(100);
    expect(
      resolveRefund({ ...booking, cancellationPolicy: stricter }, at('2026-09-02T10:00:00'))
        .refundPercent,
    ).toBe(0);
  });
});

describe('describePolicy', () => {
  it('summarises tiers widest-first', () => {
    expect(describePolicy(policy)).toBe(
      '100% until 6h before, 50% until 2h before, no refund under 2h',
    );
  });

  it('names the window a player has missed, not the zero tier\'s own bound', () => {
    // The 0% tier starts biting the moment the 50% tier stops, which is 2h — not at 0h,
    // where "under 0h" would mean the game has already started.
    expect(describePolicy(policy)).toContain('no refund under 2h');
    expect(describePolicy(policy)).not.toContain('under 0h');
  });

  it('says plainly that nothing comes back when a policy refunds nothing at all', () => {
    const none: CancellationPolicy = {
      id: 'none',
      label: 'No refunds',
      tiers: [{ hoursBefore: 0, refundPercent: 0 }],
    };

    expect(describePolicy(none)).toBe('no refund');
  });
});
