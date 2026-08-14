/**
 * Normalizes a phone number to an exact 10-digit Indian mobile number.
 * - Strips all non-digit characters.
 * - Strips leading country code '91' (or '+91') if it leaves a 10-digit number.
 * - Strips leading '0' if it leaves a 10-digit number.
 */
export function normalizePhoneNumber(rawInput) {
  if (!rawInput) return '';

  // 1. Strip all non-digit characters
  let digits = String(rawInput).replace(/\D/g, '');

  // 2. Strip leading country code '91' if the length is 12 and it starts with 91
  if (digits.length === 12 && digits.startsWith('91')) {
    digits = digits.slice(2);
  }

  // 3. Strip leading '0' if the length is 11 and it starts with 0
  if (digits.length === 11 && digits.startsWith('0')) {
    digits = digits.slice(1);
  }

  return digits;
}

/**
 * Validates if the normalized number is a valid 10-digit number.
 */
export function isValidPhoneNumber(number) {
  const normalized = normalizePhoneNumber(number);
  return normalized.length === 10;
}
