import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

// Locale negotiation and redirects. Auth is enforced per page/action on the server, never only here.
export default createMiddleware(routing);

export const config = {
  matcher: ["/((?!api|uploads|_next|_vercel|.*\\..*).*)"],
};
