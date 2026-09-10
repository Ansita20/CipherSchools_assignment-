import { describe, expect, it } from "vitest";
import { analyzeCompleteness } from "../../../src/domain/submission/SubmissionAnalyzer";
import type { Problem } from "../../../src/domain/problem/Problem";
import type { SubmissionContent } from "../../../src/domain/submission/Submission";

const problem: Problem = {
  id: "p1",
  slug: "parking-lot",
  title: "Parking Lot",
  difficulty: "easy",
  summary: "...",
  requirements: [],
  constraints: [],
  requiredConcepts: ["Vehicle", "ParkingSpot", "Ticket"],
  submissionTemplate: [
    { key: "classes", label: "Classes", helpText: "", minWords: 5 },
    { key: "tradeoffs", label: "Trade-offs", helpText: "", minWords: 5 },
  ],
  createdAt: "2026-01-01T00:00:00.000Z",
};

function content(sections: { key: string; text: string }[]): SubmissionContent {
  return { format: "structured-text", sections };
}

describe("analyzeCompleteness", () => {
  it("flags a field that's missing entirely", () => {
    const report = analyzeCompleteness(
      problem,
      content([{ key: "classes", text: "Vehicle ParkingSpot Ticket ClassA ClassB" }]),
    );

    expect(report.isMinimallyComplete).toBe(false);
    expect(report.missingFields.map((f) => f.key)).toEqual(["tradeoffs"]);
  });

  it("flags a field that's present but under the word count", () => {
    const report = analyzeCompleteness(
      problem,
      content([
        { key: "classes", text: "too short" },
        { key: "tradeoffs", text: "also short" },
      ]),
    );

    expect(report.isMinimallyComplete).toBe(false);
    expect(report.missingFields).toHaveLength(2);
    expect(report.missingFields[0].reason).toMatch(/wrote 2 words, needs at least 5/);
  });

  it("passes once every field clears its minimum", () => {
    const report = analyzeCompleteness(
      problem,
      content([
        { key: "classes", text: "Vehicle ParkingSpot Ticket ClassA ClassB" },
        { key: "tradeoffs", text: "one two three four five" },
      ]),
    );

    expect(report.isMinimallyComplete).toBe(true);
    expect(report.missingFields).toEqual([]);
  });

  it("reports missing concepts as advisory, not gating", () => {
    const report = analyzeCompleteness(
      problem,
      content([
        { key: "classes", text: "one two three four five" },
        { key: "tradeoffs", text: "one two three four five" },
      ]),
    );

    // still complete even though none of the required concepts appear
    expect(report.isMinimallyComplete).toBe(true);
    expect(report.missingConcepts).toEqual(["Vehicle", "ParkingSpot", "Ticket"]);
  });

  it("matches concepts case-insensitively", () => {
    const report = analyzeCompleteness(
      problem,
      content([
        { key: "classes", text: "a vehicle, a parkingspot, and a ticket walk into a bar" },
        { key: "tradeoffs", text: "one two three four five" },
      ]),
    );

    expect(report.missingConcepts).toEqual([]);
  });

  it("splits required concepts into mentioned vs missing, covering all of them", () => {
    const report = analyzeCompleteness(
      problem,
      content([
        { key: "classes", text: "Vehicle and ParkingSpot show up here, five words total" },
        { key: "tradeoffs", text: "one two three four five" },
      ]),
    );

    expect(report.mentionedConcepts).toEqual(["Vehicle", "ParkingSpot"]);
    expect(report.missingConcepts).toEqual(["Ticket"]);
  });

  it("detects compound PascalCase identifiers, deduped and sorted", () => {
    const report = analyzeCompleteness(
      problem,
      content([
        { key: "classes", text: "A FeeCalculator computes cost. Another FeeCalculator reference here for good measure." },
        { key: "tradeoffs", text: "A ChangeDispenser handles the rest, one two three" },
      ]),
    );

    expect(report.candidateIdentifiers).toEqual(["ChangeDispenser", "FeeCalculator"]);
  });

  it("does not treat a plain single-word capitalized name as a candidate identifier", () => {
    const report = analyzeCompleteness(
      problem,
      content([
        { key: "classes", text: "Vehicle and Ticket are plain single-word names, five words" },
        { key: "tradeoffs", text: "one two three four five" },
      ]),
    );

    expect(report.candidateIdentifiers).toEqual([]);
  });
});
