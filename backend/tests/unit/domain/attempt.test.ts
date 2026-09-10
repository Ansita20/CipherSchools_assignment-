import { describe, expect, it } from "vitest";
import { Attempt } from "../../../src/domain/attempt/Attempt";

describe("Attempt", () => {
  it("starts in_progress with no submittedAt", () => {
    const attempt = Attempt.start("problem-1", "learner-1");

    expect(attempt.status).toBe("in_progress");
    expect(attempt.submittedAt).toBeNull();
    expect(attempt.problemId).toBe("problem-1");
    expect(attempt.learnerId).toBe("learner-1");
  });

  it("moves to submitted and stamps submittedAt", () => {
    const attempt = Attempt.start("problem-1", "learner-1");

    attempt.markSubmitted();

    expect(attempt.status).toBe("submitted");
    expect(attempt.submittedAt).not.toBeNull();
  });

  it("refuses to submit an attempt twice", () => {
    const attempt = Attempt.start("problem-1", "learner-1");
    attempt.markSubmitted();

    expect(() => attempt.markSubmitted()).toThrow(/already been submitted/);
  });

  it("round-trips through toProps/fromProps", () => {
    const attempt = Attempt.start("problem-1", "learner-1");
    attempt.markSubmitted();

    const restored = Attempt.fromProps(attempt.toProps());

    expect(restored.toProps()).toEqual(attempt.toProps());
  });
});
