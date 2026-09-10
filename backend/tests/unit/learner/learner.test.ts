import { describe, expect, it } from "vitest";
import { Learner } from "../../../src/domain/learner/Learner";

describe("Learner", () => {
  it("registers with a normalized (trimmed, lowercased) email", () => {
    const learner = Learner.register("  Someone@Example.com  ", "correct-horse-battery");
    expect(learner.email).toBe("someone@example.com");
  });

  it("verifies the correct password and rejects a wrong one", () => {
    const learner = Learner.register("a@example.com", "correct-horse-battery");
    expect(learner.verifyPassword("correct-horse-battery")).toBe(true);
    expect(learner.verifyPassword("wrong-password")).toBe(false);
  });

  it("rejects an email without an @", () => {
    expect(() => Learner.register("not-an-email", "correct-horse-battery")).toThrow(/valid email/);
  });

  it("rejects a password under 8 characters", () => {
    expect(() => Learner.register("a@example.com", "short")).toThrow(/at least 8 characters/);
  });

  it("never stores the password itself - toProps only exposes a hash", () => {
    const learner = Learner.register("a@example.com", "correct-horse-battery");
    expect(learner.toProps().passwordHash).not.toContain("correct-horse-battery");
  });

  it("round-trips through toProps/fromProps and still verifies the password", () => {
    const learner = Learner.register("a@example.com", "correct-horse-battery");
    const restored = Learner.fromProps(learner.toProps());
    expect(restored.verifyPassword("correct-horse-battery")).toBe(true);
  });
});
