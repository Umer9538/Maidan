/**
 * Card entry helpers.
 *
 * Nothing here retains a card number. PCI scope stays entirely with the gateway
 * (docs/05 §6) — the app validates what the user typed so it can reject a typo before a
 * round trip, then keeps only the brand, the last four digits and the expiry.
 */

export type CardBrand = 'visa' | 'mastercard' | 'amex' | 'unionpay' | 'unknown';

/**
 * Brand from the leading digits.
 *
 * UnionPay matters here in a way it would not elsewhere: several Pakistani banks issue
 * UnionPay debit cards, and treating them as unknown would reject a card that works.
 */
export function detectBrand(cardNumber: string): CardBrand {
  const digits = onlyDigits(cardNumber);
  if (/^4/.test(digits)) return 'visa';
  if (/^(5[1-5]|2[2-7])/.test(digits)) return 'mastercard';
  if (/^3[47]/.test(digits)) return 'amex';
  if (/^62/.test(digits)) return 'unionpay';
  return 'unknown';
}

export const BRAND_LABELS: Record<CardBrand, string> = {
  visa: 'Visa',
  mastercard: 'Mastercard',
  amex: 'American Express',
  unionpay: 'UnionPay',
  unknown: 'Card',
};

/** Digit count each brand issues. Amex is 15; UnionPay runs 16 to 19. */
function validLengths(brand: CardBrand): number[] {
  if (brand === 'amex') return [15];
  if (brand === 'unionpay') return [16, 17, 18, 19];
  return [16];
}

/**
 * The Luhn check digit.
 *
 * Catches a mistyped digit and most transpositions before anything reaches the gateway,
 * which turns a declined payment into an inline correction.
 */
export function passesLuhn(cardNumber: string): boolean {
  const digits = onlyDigits(cardNumber);
  if (digits.length === 0) return false;

  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i -= 1) {
    let value = digits.charCodeAt(i) - 48;
    if (double) {
      value *= 2;
      if (value > 9) value -= 9;
    }
    sum += value;
    double = !double;
  }
  return sum % 10 === 0;
}

export function isValidCardNumber(cardNumber: string): boolean {
  const digits = onlyDigits(cardNumber);
  const brand = detectBrand(digits);
  return validLengths(brand).includes(digits.length) && passesLuhn(digits);
}

/** `4111111111111111` -> `4111 1111 1111 1111`; Amex groups 4-6-5. */
export function formatCardNumber(cardNumber: string): string {
  const digits = onlyDigits(cardNumber).slice(0, 19);
  const groups = detectBrand(digits) === 'amex' ? [4, 6, 5] : [4, 4, 4, 4, 3];

  const parts: string[] = [];
  let index = 0;
  for (const size of groups) {
    if (index >= digits.length) break;
    parts.push(digits.slice(index, index + size));
    index += size;
  }
  return parts.join(' ');
}

/** `0725` -> `07/25`, typed straight through without the user entering the slash. */
export function formatExpiry(value: string): string {
  const digits = onlyDigits(value).slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
}

/**
 * True when the expiry is a real month that has not passed.
 *
 * A card is valid through the last day of its month, so the comparison is month-level:
 * a card expiring this month still works today.
 */
export function isValidExpiry(value: string, now: Date = new Date()): boolean {
  const digits = onlyDigits(value);
  if (digits.length !== 4) return false;

  const month = Number(digits.slice(0, 2));
  const year = 2000 + Number(digits.slice(2));
  if (month < 1 || month > 12) return false;

  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  return year > currentYear || (year === currentYear && month >= currentMonth);
}

/** Amex prints a four-digit code; everyone else three. */
export function isValidCvv(cvv: string, brand: CardBrand): boolean {
  const digits = onlyDigits(cvv);
  return digits.length === (brand === 'amex' ? 4 : 3);
}

export function lastFour(cardNumber: string): string {
  return onlyDigits(cardNumber).slice(-4);
}

function onlyDigits(value: string): string {
  return value.replace(/\D/g, '');
}
