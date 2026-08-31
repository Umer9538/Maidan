import { render, screen } from '@testing-library/react-native';

import { AppBar } from '../app-bar';

describe('AppBar', () => {
  it('drops actions with no handler', async () => {
    // Several kit frames carry "more options" icons with nothing behind them. Rendered as
    // real buttons they take focus and announce a name, which is worse than their absence.
    await render(
      <AppBar
        title="Open Matches"
        actions={[
          { icon: 'search', accessibilityLabel: 'Search matches' },
          { icon: 'more-vertical', accessibilityLabel: 'More options', onPress: () => {} },
        ]}
      />,
    );

    expect(screen.queryByLabelText('Search matches')).toBeNull();
    expect(screen.getByLabelText('More options')).toBeTruthy();
  });

  it('shows the back control only when there is somewhere to go', async () => {
    const { rerender } = await render(<AppBar title="Chats" />);
    expect(screen.queryByTestId('app-bar-back')).toBeNull();

    await rerender(<AppBar title="Chats" onBack={() => {}} />);
    expect(screen.getByTestId('app-bar-back')).toBeTruthy();
  });
});
