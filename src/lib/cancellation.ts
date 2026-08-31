/**
 * Refunds, resolved against the policy snapshotted on the booking.
 *
 * The snapshot is the point: a venue that tightens its policy tomorrow must not change
 * what a player booked under today. docs/05 §5.2.
 */
import type { Booking, CancellationPolicy, Rupees } from '@/domain/types';
import { hoursUntil } from './datetime';

export interface RefundOutcome {
  refundPercent: number;
  /** Only what we actually collected online can be refunded; cash never reached us. */
  refundAmount: Rupees;
  /** The tier that applied, for display: "Free cancellation until 6h before". */
  appliedTier: { hoursBefore: number; refundPercent: number } | null;
}

/**
 * Finds the most generous tier whose window the booking is still inside.
 *
 * Tiers are read as "at least this many hours before start", so they are sorted
 * widest-first here rather than trusting the order they were authored in.
 */
export function resolveRefund(
  booking: Pick<Booking, 'paidOnline' | 'startAt' | 'cancellationPolicy'>,
  now: Date = new Date(),
): RefundOutcome {
  const remaining = hoursUntil(booking.startAt, now);
  const tiers = [...booking.cancellationPolicy.tiers].sort((a, b) => b.hoursBefore - a.hoursBefore);
  const tier = tiers.find((candidate) => remaining >= candidate.hoursBefore) ?? null;
  const refundPercent = tier?.refundPercent ?? 0;

  return {
    refundPercent,
    refundAmount: Math.floor((booking.paidOnline * refundPercent) / 100),
    appliedTier: tier,
  };
}

/** One-line summary of a policy, for the venue profile and the checkout screen. */
export function describePolicy(policy: CancellationPolicy): string {
  const tiers = [...policy.tiers].sort((a, b) => b.hoursBefore - a.hoursBefore);
  return tiers
    .map((tier, index) => {
      if (tier.refundPercent > 0) return `${tier.refundPercent}% until ${tier.hoursBefore}h before`;

      // A zero tier is the floor, and `resolveRefund` reaches it once the booking drops
      // below the tier *above* it — so naming its own bound produced "no refund under 0h",
      // which tells a player nothing. The number they need is the window they just missed.
      const above = tiers[index - 1];
      return above ? `no refund under ${above.hoursBefore}h` : 'no refund';
    })
    .join(', ');
}
