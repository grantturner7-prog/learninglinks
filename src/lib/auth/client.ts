"use client";

import { inferAdditionalFields } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

/** Browser auth client. Requests go to /api/auth/* where server-side rate limits apply. */
export const authClient = createAuthClient({
  plugins: [
    inferAdditionalFields({
      user: {
        accountType: { type: "string" },
        noticeAcknowledged: { type: "boolean" },
      },
    }),
  ],
});
