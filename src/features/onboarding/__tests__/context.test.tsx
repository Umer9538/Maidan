import { act, render, screen } from '@testing-library/react-native';

import { Text } from '@/components/ui/text';

import { OnboardingProvider, useOnboarding } from '../context';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const storage = require('@react-native-async-storage/async-storage');

function Probe() {
  const { status, complete } = useOnboarding();
  return (
    <>
      <Text testID="status">{status}</Text>
      <Text testID="complete" onPress={complete}>
        done
      </Text>
    </>
  );
}

describe('OnboardingProvider', () => {
  beforeEach(() => jest.clearAllMocks());

  it('reports pending for a first launch', async () => {
    storage.getItem.mockResolvedValue(null);

    await render(
      <OnboardingProvider>
        <Probe />
      </OnboardingProvider>,
    );

    expect(screen.getByTestId('status')).toHaveTextContent('pending');
  });

  it('reports complete for a returning user', async () => {
    storage.getItem.mockResolvedValue('true');

    await render(
      <OnboardingProvider>
        <Probe />
      </OnboardingProvider>,
    );

    expect(screen.getByTestId('status')).toHaveTextContent('complete');
  });

  it('treats a storage failure as a first launch rather than locking the user out', async () => {
    storage.getItem.mockRejectedValue(new Error('disk full'));

    await render(
      <OnboardingProvider>
        <Probe />
      </OnboardingProvider>,
    );

    expect(screen.getByTestId('status')).toHaveTextContent('pending');
  });

  it('flips to complete immediately, without waiting on the write', async () => {
    storage.getItem.mockResolvedValue(null);
    let resolveWrite: () => void = () => {};
    storage.setItem.mockReturnValue(
      new Promise<void>((resolve) => {
        resolveWrite = resolve;
      }),
    );

    await render(
      <OnboardingProvider>
        <Probe />
      </OnboardingProvider>,
    );

    await act(async () => {
      screen.getByTestId('complete').props.onPress();
    });

    expect(screen.getByTestId('status')).toHaveTextContent('complete');
    expect(storage.setItem).toHaveBeenCalledWith('maidan.onboarding.completed', 'true');
    resolveWrite();
  });
});
