import type Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it, vi } from "vitest";
import { ClaudeEvaluator } from "../../../src/infrastructure/ai/ClaudeEvaluator";
import { analyzeCompleteness } from "../../../src/domain/submission/SubmissionAnalyzer";
import type { Problem } from "../../../src/domain/problem/Problem";
import { createSubmission } from "../../../src/domain/submission/Submission";

const problem: Problem = {
  id: "p1",
  slug: "parking-lot",
  title: "Parking Lot",
  difficulty: "easy",
  summary: "A parking lot design problem.",
  requirements: ["req1"],
  constraints: ["c1"],
  requiredConcepts: ["Vehicle"],
  submissionTemplate: [{ key: "classes", label: "Classes", helpText: "", minWords: 1 }],
  createdAt: "2026-01-01T00:00:00.000Z",
};

const submission = createSubmission("attempt-1", "p1", {
  format: "structured-text",
  sections: [{ key: "classes", text: "Vehicle, ParkingSpot" }],
});

const completeness = analyzeCompleteness(problem, submission.content);

function fakeClient(parsedOutput: unknown): Anthropic {
  return {
    messages: { parse: vi.fn().mockResolvedValue({ parsed_output: parsedOutput }) },
  } as unknown as Anthropic;
}

describe("ClaudeEvaluator", () => {
  it("turns a parsed rubric response into Feedback with a computed overall score", async () => {
    const client = fakeClient({
      summary: "Reasonable design.",
      criteria: [
        { criterion: "requirement_understanding", score: 4, evidence: "e", concern: "c", suggestion: "s", confidence: "high" },
        { criterion: "responsibility_assignment", score: 2, evidence: "e", concern: "c", suggestion: "s", confidence: "low" },
      ],
    });
    const evaluator = new ClaudeEvaluator(client);

    const feedback = await evaluator.evaluate({ problem, submission, completeness });

    expect(feedback.summary).toBe("Reasonable design.");
    expect(feedback.criteria).toHaveLength(2);
    expect(feedback.overallScore).toBe(3);
    expect(feedback.generatedBy).toBe("claude-lld-rubric-v1");
  });

  it("throws a clear error when Claude doesn't return parseable output", async () => {
    const client = fakeClient(null);
    const evaluator = new ClaudeEvaluator(client);

    await expect(evaluator.evaluate({ problem, submission, completeness })).rejects.toThrow(/did not return a response matching/);
  });
});
