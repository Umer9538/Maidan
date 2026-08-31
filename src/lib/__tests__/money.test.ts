import { formatPkr, formatPkrPerHour, perPlayerShare, splitEvenly } from '../money';

describe('formatPkr', () => {
  it('groups thousands the way the frames do', () => {
    expect(formatPkr(5500)).toBe('Rs 5,500');
    expect(formatPkr(600)).toBe('Rs 600');
    expect(formatPkr(1200)).toBe('Rs 1,200');
    expect(formatPkr(1_250_000)).toBe('Rs 1,250,000');
  });

  it('handles the edges', () => {
    expect(formatPkr(0)).toBe('Rs 0');
    expect(formatPkr(-500)).toBe('-Rs 500');
    expect(formatPkr(999)).toBe('Rs 999');
    expect(formatPkr(1000)).toBe('Rs 1,000');
  });

  it('renders an hourly rate', () => {
    expect(formatPkrPerHour(5500)).toBe('Rs 5,500/hr');
  });
});

describe('splitEvenly', () => {
  it('divides a clean total evenly', () => {
    expect(splitEvenly(6000, 10)).toEqual(Array(10).fill(600));
  });

  it('never loses or invents a rupee on an uneven split', () => {
    const shares = splitEvenly(5000, 3);
    expect(shares).toEqual([1667, 1667, 1666]);
    expect(shares.reduce((sum, share) => sum + share, 0)).toBe(5000);
  });

  it('keeps every share within a rupee of every other', () => {
    for (const ways of [2, 3, 4, 5, 6, 7, 8, 10, 12]) {
      for (const total of [4500, 5500, 6000, 7333, 1]) {
        const shares = splitEvenly(total, ways);
        expect(shares.reduce((sum, share) => sum + share, 0)).toBe(total);
        expect(Math.max(...shares) - Math.min(...shares)).toBeLessThanOrEqual(1);
      }
    }
  });

  it('rejects a nonsensical number of ways', () => {
    expect(() => splitEvenly(1000, 0)).toThrow(RangeError);
    expect(() => splitEvenly(1000, -2)).toThrow(RangeError);
    expect(() => splitEvenly(1000, 2.5)).toThrow(RangeError);
  });
});

describe('perPlayerShare', () => {
  it('matches the Create Open Match example: Rs 6,000 over 10 players', () => {
    expect(perPlayerShare(6000, 10)).toBe(600);
  });

  it('rounds up so the advertised price is never short', () => {
    expect(perPlayerShare(5000, 3)).toBe(1667);
    expect(perPlayerShare(5500, 4)).toBe(1375);
  });
});
