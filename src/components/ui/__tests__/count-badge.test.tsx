import { render, screen } from '@testing-library/react-native';

import { CountBadge } from '../count-badge';

describe('CountBadge', () => {
  it('renders nothing at zero, rather than an empty green dot', async () => {
    await render(<CountBadge count={0} />);
    expect(screen.queryByLabelText(/unread/)).toBeNull();
  });

  it('caps the display so a long number cannot stretch the 16px badge', async () => {
    await render(<CountBadge count={412} />);
    expect(screen.getByText('99+')).toBeTruthy();
  });

  it('announces the real count even when the display is capped', async () => {
    await render(<CountBadge count={412} />);
    expect(screen.getByLabelText('412 unread')).toBeTruthy();
  });
});
