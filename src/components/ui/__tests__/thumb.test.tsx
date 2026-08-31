import { render, screen } from '@testing-library/react-native';

import { Thumb } from '../thumb';

describe('Thumb', () => {
  it('falls back to a monogram when there is no photo', async () => {
    await render(<Thumb id="team-1" name="Gulberg Gladiators" uri={null} />);
    expect(screen.getByText('GG')).toBeTruthy();
  });

  it('scales the line height with the font size, so a large monogram is not clipped', async () => {
    await render(<Thumb id="me" name="Umer Farhan" uri={null} dimension={96} />);

    const style = StyleSheetFlatten(screen.getByText('UF').props.style);
    const fontSize = Number(style.fontSize);
    const lineHeight = Number(style.lineHeight);

    expect(fontSize).toBe(33);
    // Anything at or below the font size would cut the glyphs off.
    expect(lineHeight).toBeGreaterThan(fontSize);
  });

  it('gives the same record the same fallback tint, and different records different ones', async () => {
    await render(
      <>
        <Thumb id="team-1" name="Gulberg Gladiators" uri={null} />
        <Thumb id="team-1" name="Gulberg Gladiators" uri={null} />
        <Thumb id="team-2" name="DHA Strikers" uri={null} />
      </>,
    );

    const [first, second] = screen
      .getAllByText('GG')
      .map((node) => StyleSheetFlatten(node.parent?.props.style).backgroundColor);
    const other = StyleSheetFlatten(screen.getByText('DS').parent?.props.style).backgroundColor;

    expect(first).toBe(second);
    expect(other).not.toBe(first);
  });
});

/** RN flattens style arrays at render; tests need the same view of them. */
function StyleSheetFlatten(style: unknown): Record<string, number | string> {
  if (!Array.isArray(style)) return (style ?? {}) as Record<string, number | string>;
  return style.reduce<Record<string, number | string>>(
    (merged, entry) => ({ ...merged, ...StyleSheetFlatten(entry) }),
    {},
  );
}
