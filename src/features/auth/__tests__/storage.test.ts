import { clearSession, readSession, writeSession, type StoredSession } from '../storage';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const storage = require('@react-native-async-storage/async-storage');

const session: StoredSession = {
  id: 'player-self',
  fullName: 'Umer Farhan',
  email: 'umer@maidan.pk',
  phone: '+923001234567',
  sports: ['padel'],
  city: 'lahore',
  ownedVenueIds: [],
};

describe('session storage', () => {
  beforeEach(() => jest.clearAllMocks());

  it('round-trips a session', async () => {
    storage.setItem.mockResolvedValue(undefined);
    await writeSession(session);

    const [, written] = storage.setItem.mock.calls[0];
    storage.getItem.mockResolvedValue(written);

    expect(await readSession()).toEqual(session);
  });

  it('returns null when nothing is stored', async () => {
    storage.getItem.mockResolvedValue(null);
    expect(await readSession()).toBeNull();
  });

  it('discards a record written by an older build rather than reading it half-populated', async () => {
    // The pre-versioning shape: no id, no email, no envelope.
    storage.getItem.mockResolvedValue(
      JSON.stringify({ phone: '+923001234567', sports: ['padel'], city: 'lahore' }),
    );
    storage.removeItem.mockResolvedValue(undefined);

    expect(await readSession()).toBeNull();
    expect(storage.removeItem).toHaveBeenCalled();
  });

  it('discards a v1 record, which had no ownedVenueIds and would strand an owner', async () => {
    storage.getItem.mockResolvedValue(JSON.stringify({ version: 1, session }));
    storage.removeItem.mockResolvedValue(undefined);
    expect(await readSession()).toBeNull();
  });

  it('discards a future version it cannot understand', async () => {
    storage.getItem.mockResolvedValue(JSON.stringify({ version: 99, session }));
    storage.removeItem.mockResolvedValue(undefined);
    expect(await readSession()).toBeNull();
  });

  it('survives corrupt JSON without throwing', async () => {
    storage.getItem.mockResolvedValue('{not json');
    expect(await readSession()).toBeNull();
  });

  it('treats a read failure as signed out rather than crashing the launch', async () => {
    storage.getItem.mockRejectedValue(new Error('disk'));
    expect(await readSession()).toBeNull();
  });

  it('swallows a write failure — it costs a re-login, not a crash', async () => {
    storage.setItem.mockRejectedValue(new Error('full'));
    await expect(writeSession(session)).resolves.toBeUndefined();
  });

  it('swallows a clear failure', async () => {
    storage.removeItem.mockRejectedValue(new Error('nope'));
    await expect(clearSession()).resolves.toBeUndefined();
  });
});
