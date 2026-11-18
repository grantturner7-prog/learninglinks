/** The public support address (appeals, privacy requests, reports). Set SUPPORT_EMAIL in the environment. */
export function supportEmail(): string | null {
  const v = process.env.SUPPORT_EMAIL?.trim();
  return v ? v : null;
}
