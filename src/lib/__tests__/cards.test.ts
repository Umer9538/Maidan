import {
  detectBrand,
  formatCardNumber,
  formatExpiry,
  isValidCardNumber,
  isValidCvv,
  isValidExpiry,
  lastFour,
  passesLuhn,
} from '../cards';

describe('detectBrand', () => {
  it('recognises the brands a Pakistani player is likely to hold', () => {
    expect(detectBrand('4111111111111111')).toBe('visa');
    expect(detectBrand('5500005555555559')).toBe('mastercard');
    expect(detectBrand('2221000000000009')).toBe('mastercard');
    expect(detectBrand('378282246310005')).toBe('amex');
    // Several Pakistani banks issue UnionPay debit cards.
    expect(detectBrand('6250947000000014')).toBe('unionpay');
  });

  it('falls back to unknown rather than guessing', () => {
    expect(detectBrand('9999999999999999')).toBe('unknown');
    expect(detectBrand('')).toBe('unknown');
  });
});

describe('passesLuhn', () => {
  it('accepts real check digits', () => {
    expect(passesLuhn('4111111111111111')).toBe(true);
    expect(passesLuhn('378282246310005')).toBe(true);
  });

  it('rejects a single mistyped digit', () => {
    expect(passesLuhn('4111111111111112')).toBe(false);
  });

  it('rejects an empty string rather than treating it as valid', () => {
    expect(passesLuhn('')).toBe(false);
  });
});

describe('isValidCardNumber', () => {
  it('accepts a well-formed number of the right length for its brand', () => {
    expect(isValidCardNumber('4111 1111 1111 1111')).toBe(true);
    expect(isValidCardNumber('3782 822463 10005')).toBe(true);
  });

  it('rejects a 16-digit Amex, which is the wrong length for that brand', () => {
    expect(isValidCardNumber('3782822463100050')).toBe(false);
  });

  it('rejects a number that is too short even when Luhn passes so far', () => {
    expect(isValidCardNumber('4111')).toBe(false);
  });
});

describe('formatCardNumber', () => {
  it('groups in fours', () => {
    expect(formatCardNumber('4111111111111111')).toBe('4111 1111 1111 1111');
  });

  it('groups Amex 4-6-5, the way the card is printed', () => {
    expect(formatCardNumber('378282246310005')).toBe('3782 822463 10005');
  });

  it('formats a partial number as it is typed', () => {
    expect(formatCardNumber('411111')).toBe('4111 11');
  });

  it('drops anything that is not a digit', () => {
    expect(formatCardNumber('4111-1111 1111_1111')).toBe('4111 1111 1111 1111');
  });
});

describe('formatExpiry', () => {
  it('inserts the slash so the user does not have to', () => {
    expect(formatExpiry('0725')).toBe('07/25');
    expect(formatExpiry('07')).toBe('07');
    expect(formatExpiry('0')).toBe('0');
  });
});

describe('isValidExpiry', () => {
  const now = new Date('2026-08-30T00:00:00Z');

  it('accepts a future month', () => {
    expect(isValidExpiry('07/27', now)).toBe(true);
  });

  it('accepts the current month — a card is good to its last day', () => {
    expect(isValidExpiry('08/26', now)).toBe(true);
  });

  it('rejects a month that has passed', () => {
    expect(isValidExpiry('07/26', now)).toBe(false);
  });

  it('rejects an impossible month', () => {
    expect(isValidExpiry('13/27', now)).toBe(false);
    expect(isValidExpiry('00/27', now)).toBe(false);
  });

  it('rejects an incomplete entry', () => {
    expect(isValidExpiry('07/2', now)).toBe(false);
  });
});

describe('isValidCvv', () => {
  it('wants four digits for Amex and three for everyone else', () => {
    expect(isValidCvv('1234', 'amex')).toBe(true);
    expect(isValidCvv('123', 'amex')).toBe(false);
    expect(isValidCvv('123', 'visa')).toBe(true);
    expect(isValidCvv('1234', 'visa')).toBe(false);
  });
});

describe('lastFour', () => {
  it('takes the last four digits, ignoring spacing', () => {
    expect(lastFour('4111 1111 1111 1111')).toBe('1111');
  });
});
