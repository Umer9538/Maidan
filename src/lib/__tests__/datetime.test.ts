import {
  formatClock,
  formatCountdown,
  formatRelative,
  formatSlotShort,
  formatOpeningHours,
  hoursUntil,
  pktDayDifference,
  secondsUntil,
  toPkt,
} from '../datetime';

const pkt = (isoLocal: string) => `${isoLocal}+05:00`;

describe('toPkt', () => {
  it('reads the wall clock in Pakistan regardless of the device zone', () => {
    // 16:00Z is 21:00 in Lahore.
    expect(toPkt('2026-09-02T16:00:00Z')).toMatchObject({
      year: 2026,
      month: 9,
      day: 2,
      hour: 21,
      minute: 0,
    });
  });

  it('rolls the date over correctly late at night', () => {
    // 20:00Z on the 2nd is 01:00 on the 3rd in Lahore — a peak cricket slot.
    expect(toPkt('2026-09-02T20:00:00Z')).toMatchObject({ day: 3, hour: 1 });
  });
});

describe('formatClock', () => {
  it('drops zero minutes, as the frames do', () => {
    expect(formatClock(pkt('2026-09-02T21:00:00'))).toBe('9 PM');
    expect(formatClock(pkt('2026-09-02T18:00:00'))).toBe('6 PM');
  });

  it('keeps non-zero minutes', () => {
    expect(formatClock(pkt('2026-09-02T21:30:00'))).toBe('9:30 PM');
  });

  it('handles both noon and midnight', () => {
    expect(formatClock(pkt('2026-09-02T12:00:00'))).toBe('12 PM');
    expect(formatClock(pkt('2026-09-02T00:00:00'))).toBe('12 AM');
  });
});

describe('formatSlotShort', () => {
  // A Wednesday, 10 AM in Lahore.
  const now = new Date(pkt('2026-09-02T10:00:00'));

  it('calls an evening slot today "Tonight", the way a player would', () => {
    expect(formatSlotShort(pkt('2026-09-02T21:00:00'), { now })).toBe('Tonight, 9 PM');
  });

  it('calls a daytime slot today "Today"', () => {
    expect(formatSlotShort(pkt('2026-09-02T11:00:00'), { now })).toBe('Today, 11 AM');
  });

  it('names tomorrow', () => {
    expect(formatSlotShort(pkt('2026-09-03T20:00:00'), { now })).toBe('Tomorrow, 8 PM');
  });

  it('uses the weekday inside the coming week', () => {
    expect(formatSlotShort(pkt('2026-09-05T18:00:00'), { now })).toBe('Saturday, 6 PM');
  });

  it('abbreviates the weekday for the tighter challenge card', () => {
    expect(formatSlotShort(pkt('2026-09-05T21:00:00'), { now, abbreviateWeekday: true })).toBe(
      'Sat, 9 PM',
    );
  });

  it('falls back to a date beyond a week out', () => {
    expect(formatSlotShort(pkt('2026-09-20T18:00:00'), { now })).toBe('20 Sep, 6 PM');
  });

  it('counts calendar days, not 24h spans, so 1 AM tonight is not "Tomorrow"', () => {
    const lateEvening = new Date(pkt('2026-09-02T23:00:00'));
    expect(formatSlotShort(pkt('2026-09-03T01:00:00'), { now: lateEvening })).toBe(
      'Tomorrow, 1 AM',
    );
  });
});

describe('pktDayDifference', () => {
  it('counts calendar days in PKT', () => {
    expect(pktDayDifference(pkt('2026-09-02T23:00:00'), pkt('2026-09-03T01:00:00'))).toBe(1);
    expect(pktDayDifference(pkt('2026-09-02T01:00:00'), pkt('2026-09-02T23:00:00'))).toBe(0);
  });
});

describe('formatRelative', () => {
  const now = new Date(pkt('2026-09-02T21:00:00'));

  it('matches the Chats frame scale', () => {
    expect(formatRelative(pkt('2026-09-02T20:58:00'), now)).toBe('2 min ago');
    expect(formatRelative(pkt('2026-09-02T20:50:00'), now)).toBe('10 min ago');
    expect(formatRelative(pkt('2026-09-02T18:00:00'), now)).toBe('3 hr ago');
    expect(formatRelative(pkt('2026-09-01T21:00:00'), now)).toBe('Yesterday');
    expect(formatRelative(pkt('2026-08-31T21:00:00'), now)).toBe('2 days ago');
  });

  it('falls back to a date past a week', () => {
    expect(formatRelative(pkt('2026-08-20T21:00:00'), now)).toBe('20 Aug');
  });

  it('says "Just now" rather than "0 min ago"', () => {
    expect(formatRelative(pkt('2026-09-02T20:59:30'), now)).toBe('Just now');
  });
});

describe('formatCountdown', () => {
  it('renders the 5-minute checkout hold', () => {
    expect(formatCountdown(300)).toBe('5:00');
    expect(formatCountdown(59)).toBe('0:59');
    expect(formatCountdown(9)).toBe('0:09');
  });

  it('floors at zero rather than going negative', () => {
    expect(formatCountdown(-5)).toBe('0:00');
  });
});

describe('secondsUntil', () => {
  const now = new Date(pkt('2026-09-02T21:00:00')).getTime();

  it('counts whole seconds to the deadline', () => {
    expect(secondsUntil(pkt('2026-09-02T21:05:00'), now)).toBe(300);
    expect(secondsUntil(pkt('2026-09-02T21:00:03'), now)).toBe(3);
  });

  it('floors partial seconds rather than rounding up', () => {
    expect(secondsUntil(now + 2999, now)).toBe(2);
  });

  it('floors at zero once the deadline has passed', () => {
    expect(secondsUntil(pkt('2026-09-02T20:59:00'), now)).toBe(0);
    expect(secondsUntil(now, now)).toBe(0);
  });

  it('reflects a clock that jumped forward while timers were suspended', () => {
    // The app was backgrounded for four minutes of a five-minute hold.
    const deadline = now + 300_000;
    expect(secondsUntil(deadline, now + 240_000)).toBe(60);
  });

  it('returns zero for an unparseable instant rather than NaN', () => {
    expect(secondsUntil('not a date', now)).toBe(0);
  });
});

describe('hoursUntil', () => {
  it('is negative once the slot has started', () => {
    const now = new Date(pkt('2026-09-02T21:00:00'));
    expect(hoursUntil(pkt('2026-09-02T23:00:00'), now)).toBe(2);
    expect(hoursUntil(pkt('2026-09-02T20:00:00'), now)).toBe(-1);
  });
});

describe('formatOpeningHours', () => {
  it('reads a normal day as a range', () => {
    expect(formatOpeningHours('09:00', '02:00')).toBe('Open 9 AM – 2 AM');
  });

  it('names a round-the-clock venue rather than printing 00:00 – 23:59', () => {
    // Several Lahore futsal arenas run 24/7 (docs/01 §2).
    expect(formatOpeningHours('00:00', '23:59')).toBe('Open 24 hours');
  });

  it('keeps minutes when a venue opens on the half hour', () => {
    expect(formatOpeningHours('09:30', '23:00')).toBe('Open 9:30 AM – 11 PM');
  });
});
