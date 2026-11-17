import { describe, expect, it } from "vitest";
import { mapAuthError } from "@/lib/auth/errors";

describe("mapAuthError", () => {
  it("maps known codes", () => {
    expect(mapAuthError({ code: "INVALID_EMAIL_OR_PASSWORD", status: 401 })).toBe("invalid");
    expect(mapAuthError({ code: "EMAIL_NOT_VERIFIED", status: 403 })).toBe("notVerified");
    expect(mapAuthError({ code: "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL", status: 422 })).toBe("exists");
    expect(mapAuthError({ code: "PASSWORD_TOO_SHORT", status: 400 })).toBe("weak");
    expect(mapAuthError({ code: "NOTICE_NOT_ACKNOWLEDGED", status: 400 })).toBe("ackRequired");
    expect(mapAuthError({ message: "NOTICE_NOT_ACKNOWLEDGED", status: 400 })).toBe("ackRequired");
  });
  it("treats too many requests as rate limited", () => {
    expect(mapAuthError({ status: 429 })).toBe("rateLimited");
  });
  it("never exposes unknown server detail", () => {
    expect(mapAuthError({ code: "SOMETHING_ELSE", message: "SQL error at table user", status: 500 })).toBe("generic");
    expect(mapAuthError(null)).toBe("generic");
    expect(mapAuthError(undefined)).toBe("generic");
  });
});
