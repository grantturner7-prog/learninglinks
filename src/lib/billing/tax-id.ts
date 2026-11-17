/**
 * Taiwan uniform invoice number (統一編號): 8 digits with a checksum.
 * Weights 1,2,1,2,1,2,4,1; each product is reduced to the sum of its digits; the total must divide by 5
 * (the rule in force since 2023). When the 7th digit is 7 the total may also be one short of a multiple of 5.
 */
export function isValidTaxId(value: string): boolean {
  if (!/^\d{8}$/.test(value)) return false;
  const weights = [1, 2, 1, 2, 1, 2, 4, 1];
  const digits = [...value].map(Number);
  const sum = digits.reduce((acc, d, i) => {
    const p = d * weights[i]!;
    return acc + Math.floor(p / 10) + (p % 10);
  }, 0);
  return sum % 5 === 0 || (digits[6] === 7 && (sum + 1) % 5 === 0);
}
