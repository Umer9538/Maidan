import { render, screen } from '@testing-library/react-native';

import { Button } from '../button';
import { colors } from '@/theme';

/** RN flattens style arrays at render; tests need the same view of them. */
function flatten(style: unknown): Record<string, string | number> {
  if (!Array.isArray(style)) return (style ?? {}) as Record<string, string | number>;
  return style.reduce<Record<string, string | number>>(
    (merged, entry) => ({ ...merged, ...flatten(entry) }),
    {},
  );
}

function fillOf(testID: string): Record<string, string | number> {
  // The fill sits one level under the pressable.
  const node = screen.getByTestId(testID);
  return flatten(
    node.children.flatMap((child) => (typeof child === 'string' ? [] : [child.props.style]))[0],
  );
}

describe('Button variants', () => {
  it('fills accent with the brand orange', async () => {
    await render(<Button label="Apply" variant="accent" testID="b" />);
    expect(fillOf('b').backgroundColor).toBe(colors.orange);
  });

  it('fills soft with the peach wash, not a transparent outline', async () => {
    // Regression: `soft` previously fell through to `secondary`, so the quiet button in a
    // pair rendered as a white outline and the loud one looked disabled beside it.
    await render(<Button label="No thanks" variant="soft" testID="b" />);
    const fill = fillOf('b');
    expect(fill.backgroundColor).toBe(colors.orangeWash);
    expect(fill.borderWidth).toBeUndefined();
  });

  it('leaves secondary transparent with a hairline', async () => {
    await render(<Button label="Done" variant="secondary" testID="b" />);
    const fill = fillOf('b');
    expect(fill.backgroundColor).toBe('transparent');
    expect(fill.borderWidth).toBe(1);
  });

  it('labels soft in the darkest orange, the only one that clears AA on the wash', async () => {
    await render(<Button label="No thanks" variant="soft" testID="b" />);
    expect(flatten(screen.getByText('No thanks').props.style).color).toBe(colors.orangeDeep);
  });

  it('labels accent in ink — white on the brand orange is 2.97:1', async () => {
    await render(<Button label="Apply" variant="accent" testID="b" />);
    expect(flatten(screen.getByText('Apply').props.style).color).toBe(colors.textOnOrange);
  });
});
