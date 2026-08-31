import { chipParts, groupByDay, headingFor } from '../agenda';

const at = (isoLocal: string) => `${isoLocal}+05:00`;

describe('groupByDay', () => {
  it('returns nothing for an empty schedule', () => {
    expect(groupByDay([])).toEqual([]);
  });

  it('buckets entries by calendar day and orders the days', () => {
    const days = groupByDay([
      { id: 'c', startAt: at('2026-09-04T18:00:00') },
      { id: 'a', startAt: at('2026-09-02T21:00:00') },
      { id: 'b', startAt: at('2026-09-02T19:00:00') },
    ]);

    expect(days).toHaveLength(2);
    expect(days[0].entries.map((entry) => entry.id)).toEqual(['b', 'a']);
    expect(days[1].entries.map((entry) => entry.id)).toEqual(['c']);
  });

  it('splits a late slot from an early one across midnight, as a calendar does', () => {
    // 11 PM and 1 AM are two hours apart but land on different days.
    const days = groupByDay([
      { id: 'late', startAt: at('2026-09-02T23:00:00') },
      { id: 'early', startAt: at('2026-09-03T01:00:00') },
    ]);

    expect(days).toHaveLength(2);
  });

  it('counts days in Pakistan time, not the device zone', () => {
    // 20:00Z is 01:00 the next day in Lahore.
    const days = groupByDay([
      { id: 'a', startAt: '2026-09-02T16:00:00Z' },
      { id: 'b', startAt: '2026-09-02T20:00:00Z' },
    ]);

    expect(days).toHaveLength(2);
  });

  it('takes the day marker from the earliest entry that day', () => {
    const days = groupByDay([
      { id: 'late', startAt: at('2026-09-02T21:00:00') },
      { id: 'early', startAt: at('2026-09-02T09:00:00') },
    ]);

    expect(days[0].day).toBe(at('2026-09-02T09:00:00'));
  });
});

describe('chipParts', () => {
  it('pads the day so the chip does not jump width', () => {
    expect(chipParts(at('2026-09-02T21:00:00'))).toEqual({ month: 'Sep', day: '02' });
    expect(chipParts(at('2026-10-22T21:00:00'))).toEqual({ month: 'Oct', day: '22' });
  });
});

describe('headingFor', () => {
  it('reads as the frame prints it', () => {
    expect(headingFor(at('2026-09-02T21:00:00'))).toBe('Wed, 2 September 2026');
  });

  it('uses the Pakistan date for a slot past midnight', () => {
    expect(headingFor('2026-09-02T20:00:00Z')).toBe('Thu, 3 September 2026');
  });
});
