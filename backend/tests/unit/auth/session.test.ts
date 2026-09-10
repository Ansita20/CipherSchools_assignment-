import { describe, expect, it } from "vitest";
import { signSessionToken, verifySessionToken } from "../../../src/infrastructure/auth/session";

describe("session token", () => {
  it("round-trips a learner id", () => {
    const token = signSessionToken("learner-123", "test-secret");
    expect(verifySessionToken(token, "test-secret")).toBe("learner-123");
  });

  it("rejects a token signed with a different secret", () => {
    const token = signSessionToken("learner-123", "test-secret");
    expect(verifySessionToken(token, "wrong-secret")).toBeNull();
  });

  it("rejects garbage input instead of throwing", () => {
    expect(verifySessionToken("not-a-real-token", "test-secret")).toBeNull();
  });
});
