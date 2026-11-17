import { getEnv } from "@/lib/env";

export interface BankDetails {
  bankName: string;
  branch: string | null;
  accountName: string;
  accountNumber: string;
}

/** Where members send a bank transfer. Null until the owner sets the BANK_* variables: the order page then says so. */
export function getBankDetails(): BankDetails | null {
  const env = getEnv();
  if (!env.BANK_NAME || !env.BANK_ACCOUNT_NAME || !env.BANK_ACCOUNT_NUMBER) return null;
  return { bankName: env.BANK_NAME, branch: env.BANK_BRANCH ?? null, accountName: env.BANK_ACCOUNT_NAME, accountNumber: env.BANK_ACCOUNT_NUMBER };
}
