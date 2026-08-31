import { isValidEmail, isValidPassword, isValidPhone, normalisePhone } from '../validation';

describe('isValidEmail', () => {
  it('accepts ordinary addresses', () => {
    expect(isValidEmail('umer@maidan.pk')).toBe(true);
    expect(isValidEmail('a.b+tag@sub.example.co')).toBe(true);
    expect(isValidEmail('  spaced@example.com  ')).toBe(true);
  });

  it('rejects what is obviously not an address', () => {
    expect(isValidEmail('')).toBe(false);
    expect(isValidEmail('umer')).toBe(false);
    expect(isValidEmail('umer@')).toBe(false);
    expect(isValidEmail('umer@host')).toBe(false);
    expect(isValidEmail('a b@example.com')).toBe(false);
  });
});

describe('normalisePhone', () => {
  it('strips the leading zero Pakistani users type', () => {
    expect(normalisePhone('0300 1234567')).toBe('3001234567');
  });

  it('strips a country code the user typed as well', () => {
    expect(normalisePhone('92 300 1234567')).toBe('3001234567');
  });

  it('drops spaces and dashes', () => {
    expect(normalisePhone('300-123-4567')).toBe('3001234567');
  });
});

describe('isValidPhone', () => {
  it('accepts a 10-digit national number however it is typed', () => {
    expect(isValidPhone('3001234567')).toBe(true);
    expect(isValidPhone('0300 1234567')).toBe(true);
  });

  it('rejects the wrong length', () => {
    expect(isValidPhone('300123456')).toBe(false);
    expect(isValidPhone('30012345678')).toBe(false);
    expect(isValidPhone('')).toBe(false);
  });
});

describe('isValidPassword', () => {
  it('accepts eight characters or more', () => {
    expect(isValidPassword('abcdefgh')).toBe(true);
    expect(isValidPassword('a longer passphrase')).toBe(true);
  });

  it('rejects anything shorter', () => {
    expect(isValidPassword('abc')).toBe(false);
    expect(isValidPassword('')).toBe(false);
  });
});
