"use client";

import { createAuthClient } from "better-auth/react";

/** Browser auth client. Requests go to /api/auth/* where server-side rate limits apply. */
export const authClient = createAuthClient();
