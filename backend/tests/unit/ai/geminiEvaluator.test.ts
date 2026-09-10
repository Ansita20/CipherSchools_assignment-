import type { GoogleGenAI } from "@google/genai";
import { describe, expect, it, vi } from "vitest";
import { GeminiEvaluator } from "../../../src/infrastructure/ai/GeminiEvaluator";
import { RUBRIC_CRITERIA } from "../../../src/domain/evaluation/Feedback";
import { analyzeCompleteness } from "../../../src/domain/submission/SubmissionAnalyzer";
import type { Problem } from "../../../src/domain/problem/Problem";
import { createSubmission } from "../../../src/domain/submission/Submission";

// GeminiEvaluator validates the response against the full rubric shape
// itself (Gemini has no equivalent of Anthropic's messages.parse), so a
// realistic fixture needs all eight criteria, not just a couple.
function allCriteriaScored(score: 1 | 2 | 3 | 4 | 5) {
  return RUBRIC_CRITERIA.map((c) => ({
    criterion: c.key,
    score,
    evidence: "e",
    concern: "c",
    suggestion: "s",
    confidence: "high" as const,
  }));
}

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

function fakeClient(text: string | undefined): GoogleGenAI {
  return {
    models: { generateContent: vi.fn().mockResolvedValue({ text }) },
  } as unknown as GoogleGenAI;
}

describe("GeminiEvaluator", () => {
  it("turns a parsed rubric response into Feedback with a computed overall score", async () => {
    const client = fakeClient(
      JSON.stringify({
        summary: "Reasonable design.",
        criteria: allCriteriaScored(4),
      }),
    );
    const evaluator = new GeminiEvaluator(client);

    const feedback = await evaluator.evaluate({ problem, submission, completeness });

    expect(feedback.summary).toBe("Reasonable design.");
    expect(feedback.criteria).toHaveLength(RUBRIC_CRITERIA.length);
    expect(feedback.overallScore).toBe(4);
    expect(feedback.generatedBy).toBe("gemini-lld-rubric-v1");
  });

  it("throws a clear error when Gemini returns no text (e.g. blocked by a safety filter)", async () => {
    const client = fakeClient(undefined);
    const evaluator = new GeminiEvaluator(client);

    await expect(evaluator.evaluate({ problem, submission, completeness })).rejects.toThrow(/no content/);
  });

  it("throws a clear error when the JSON doesn't match the rubric schema", async () => {
    const client = fakeClient(JSON.stringify({ summary: "ok", criteria: "not an array" }));
    const evaluator = new GeminiEvaluator(client);

    await expect(evaluator.evaluate({ problem, submission, completeness })).rejects.toThrow(/did not return a response matching/);
  });
});
