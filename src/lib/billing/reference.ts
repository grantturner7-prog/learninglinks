import { randomInt } from "node:crypto";

/** No 0/O, 1/I/L: a code read out over the phone or typed from a bank statement must not be ambiguous. */
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/** The code the payer quotes on a bank transfer, e.g. LL-7K3Q-9FXD. 8 characters from 31 = about 8.5e11 values. */
export function generateReferenceCode(): string {
  const pick = () => ALPHABET[randomInt(ALPHABET.length)]!;
  const block = () => Array.from({ length: 4 }, pick).join("");
  return `LL-${block()}-${block()}`;
}

/** Bank notes arrive in any case and with stray spaces or dashes. Normalise before matching. */
export function normaliseReference(input: string): string {
  const s = input.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const m = /^LL([A-Z0-9]{4})([A-Z0-9]{4})$/.exec(s);
  return m ? `LL-${m[1]}-${m[2]}` : input.trim().toUpperCase();
}
