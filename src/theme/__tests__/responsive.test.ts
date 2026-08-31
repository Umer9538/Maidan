/**
 * The scale factor is read from `Dimensions` at module load, so each case re-imports the
 * module with a different reported viewport rather than trying to mutate a frozen value.
 */
function loadWith(width: number, height = 812) {
  jest.resetModules();
  jest.doMock('react-native', () => ({
    Dimensions: { get: () => ({ width, height }) },
    PixelRatio: { roundToNearestPixel: (value: number) => Math.round(value * 3) / 3 },
  }));
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('../responsive') as typeof import('../responsive');
}

afterEach(() => jest.dontMock('react-native'));

describe('scaleFactor', () => {
  it('is 1 on the artboard width', () => {
    expect(loadWith(375).scaleFactor).toBe(1);
  });

  it('grows on a larger phone', () => {
    const { scaleFactor } = loadWith(430);
    expect(scaleFactor).toBeGreaterThan(1);
    expect(scaleFactor).toBeLessThanOrEqual(1.15);
  });

  it('shrinks on a small phone', () => {
    const { scaleFactor } = loadWith(320);
    expect(scaleFactor).toBeLessThan(1);
    expect(scaleFactor).toBeGreaterThanOrEqual(0.88);
  });

  it('clamps rather than shrinking a tiny viewport into illegibility', () => {
    // The 10pt meta line is the floor; below 0.88 it stops being readable.
    expect(loadWith(240).scaleFactor).toBe(0.88);
  });

  it('caps on a tablet instead of rendering phone furniture at double size', () => {
    expect(loadWith(834, 1194).scaleFactor).toBeLessThanOrEqual(1.15);
    expect(loadWith(1024, 1366).scaleFactor).toBeLessThanOrEqual(1.15);
  });
});

describe('s', () => {
  it('leaves design values untouched on the artboard', () => {
    const { s } = loadWith(375);
    expect(s(24)).toBe(24);
    expect(s(327)).toBe(327);
  });

  it('scales proportionally on a wider phone', () => {
    const { s } = loadWith(430);
    // The content column keeps its share of the screen.
    expect(s(327) / 430).toBeCloseTo(327 / 375, 1);
  });
});

describe('ms', () => {
  it('moves type less than the layout around it', () => {
    const { s, ms } = loadWith(430);
    const layoutGrowth = s(20) - 20;
    const typeGrowth = ms(20) - 20;
    expect(typeGrowth).toBeGreaterThan(0);
    expect(typeGrowth).toBeLessThan(layoutGrowth);
  });

  it('does not move type at all at factor 0', () => {
    const { ms } = loadWith(430);
    expect(ms(14, 0)).toBe(14);
  });
});

describe('isWideViewport', () => {
  it('is false for phones and true for tablets', () => {
    expect(loadWith(375).isWideViewport).toBe(false);
    expect(loadWith(430).isWideViewport).toBe(false);
    expect(loadWith(834, 1194).isWideViewport).toBe(true);
  });
});
