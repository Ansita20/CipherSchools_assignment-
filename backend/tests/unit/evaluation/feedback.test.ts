import { describe, expect, it } from "vitest";
import { computeOverallScore, type CriterionFeedback } from "../../../src/domain/evaluation/Feedback";

function criterion(score: 1 | 2 | 3 | 4 | 5): CriterionFeedback {
  return {
    criterion: "requirement_understanding",
    score,
    evidence: "",
    concern: "",
    suggestion: "",
    confidence: "medium",
  };
}

describe("computeOverallScore", () => {
  it("averages and rounds to one decimal place", () => {
    expect(computeOverallScore([criterion(3), criterion(4), criterion(4)])).toBeCloseTo(3.7, 5);
  });

  it("returns 0 for an empty criteria list", () => {
    expect(computeOverallScore([])).toBe(0);
  });

  it("returns the exact score for a single criterion", () => {
    expect(computeOverallScore([criterion(5)])).toBe(5);
  });
});
