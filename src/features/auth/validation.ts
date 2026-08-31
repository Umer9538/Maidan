/**
 * Credential validation, kept out of the screens so the rules are testable and stated once.
 */

/**
 * Deliberately permissive: one @, something either side, a dot in the domain. Stricter
 * regexes reject valid addresses, and only the confirmation mail proves an address works.
 */
export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());
}

/** Pakistani mobile numbers are 10 digits after +92; users type the leading 0. */
export function normalisePhone(value: string): string {
  return value.replace(/\D/g, '').replace(/^(0|92)+/, '');
}

export function isValidPhone(value: string): boolean {
  return normalisePhone(value).length === 10;
}

export const MIN_PASSWORD_LENGTH = 8;

/**
 * Length only. Composition rules (a symbol, a capital) push people towards `Password1!`
 * and are worse than a longer passphrase; length is the property that actually helps.
 */
export function isValidPassword(value: string): boolean {
  return value.length >= MIN_PASSWORD_LENGTH;
}

export function describePasswordRule(): string {
  return `At least ${MIN_PASSWORD_LENGTH} characters`;
}
