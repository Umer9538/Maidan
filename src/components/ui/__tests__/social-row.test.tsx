import { render, screen } from '@testing-library/react-native';

import { SocialRow } from '../social-row';

describe('SocialRow', () => {
  it('drops providers with no handler', async () => {
    // The Figma frame offers Facebook, Google and Apple. Only Google is wired up, and an
    // Apple button on Android could never work at all. Rendered anyway they look identical
    // to the one that works, so a player taps them and nothing happens.
    await render(
      <SocialRow
        providers={[
          { name: 'facebook', label: 'Continue with Facebook' },
          { name: 'google', label: 'Continue with Google', onPress: () => {} },
          { name: 'apple', label: 'Continue with Apple' },
        ]}
      />,
    );

    expect(screen.queryByLabelText('Continue with Facebook')).toBeNull();
    expect(screen.queryByLabelText('Continue with Apple')).toBeNull();
    expect(screen.getByLabelText('Continue with Google')).toBeTruthy();
  });

  it('renders nothing at all when no provider is wired up', async () => {
    // Without this the divider and its "or continue with" label float above empty space.
    await render(<SocialRow providers={[{ name: 'apple', label: 'Continue with Apple' }]} />);

    expect(screen.queryByText('or continue with')).toBeNull();
  });
});
