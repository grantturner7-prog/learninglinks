import createMiddleware from "next-intl/middleware";
import { NextRequest } from "next/server";
import { buildCsp, newNonce } from "./lib/csp";
import { routing } from "./i18n/routing";

const intl = createMiddleware(routing);

/**
 * Locale negotiation and redirects, plus the Content-Security-Policy with a fresh nonce for every page request.
 * Auth is enforced per page/action on the server, never only here.
 */
export default function proxy(request: NextRequest) {
  const production = process.env.NODE_ENV === "production";
  const nonce = newNonce();
  const csp = buildCsp(nonce, production);
  // Next.js reads the nonce from the request's CSP header and puts it on the scripts it renders.
  const headers = new Headers(request.headers);
  headers.set("x-nonce", nonce);
  headers.set("Content-Security-Policy", csp);
  const response = intl(new NextRequest(request, { headers }));
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: ["/((?!api|uploads|_next|_vercel|.*\\..*).*)"],
};
