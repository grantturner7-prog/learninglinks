/**
 * Content-Security-Policy for pages. Scripts run only if they carry this request's one-time nonce (Next.js adds it to
 * its own scripts), so an injected <script> cannot execute. The map needs same-origin workers (and blob: workers);
 * nothing is loaded from any other host.
 */
export function buildCsp(nonce: string, production: boolean, extraFormTargets: readonly string[] = []): string {
  const directives = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${production ? "" : " 'unsafe-eval'"}`,
    // React and Next write inline style attributes; styles cannot run code, so inline styles are allowed.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "connect-src 'self'",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    // The online-payment button posts a signed form to the payment provider's page, so that one address is allowed.
    `form-action 'self'${extraFormTargets.length > 0 ? ` ${extraFormTargets.join(" ")}` : ""}`,
    "frame-ancestors 'none'",
  ];
  if (production) directives.push("upgrade-insecure-requests");
  return directives.join("; ");
}

export function newNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return btoa(String.fromCharCode(...bytes));
}
