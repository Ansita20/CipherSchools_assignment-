// Fixed rubric shared by every evaluator implementation. Keeping it fixed
// (rather than letting each evaluator invent its own dimensions) is what
// makes feedback comparable across attempts and across evaluators - the
// point of History is watching a score for "coupling_cohesion" move over
// three attempts, which only means something if it's the same question
// each time.
export const RUBRIC_CRITERIA = [
  {
    key: "requirement_understanding",
    label: "Requirement understanding",
    description: "Does the design address the stated requirements, with reasonable assumptions called out?",
  },
  {
    key: "responsibility_assignment",
    label: "Responsibility assignment",
    description: "Does each class/interface have a single, clear responsibility?",
  },
  {
    key: "coupling_cohesion",
    label: "Coupling & cohesion",
    description: "Are related behaviours grouped together, and unrelated ones kept independent?",
  },
  {
    key: "encapsulation_interfaces",
    label: "Encapsulation & interfaces",
    description: "Is internal state hidden behind interfaces rather than exposed directly?",
  },
  {
    key: "abstraction_patterns",
    label: "Abstraction & patterns",
    description: "Are abstractions and patterns used because they earn their complexity, not just to show them off?",
  },
  {
    key: "extensibility",
    label: "Extensibility",
    description: "Could a plausible new requirement be added without reworking the core design?",
  },
  {
    key: "edge_cases_testability",
    label: "Edge cases & testability",
    description: "Does the design account for edge cases, and would it be easy to test?",
  },
  {
    key: "explanation_quality",
    label: "Explanation quality",
    description: "Are trade-offs explained, not just asserted?",
  },
] as const;

export type RubricCriterionKey = (typeof RUBRIC_CRITERIA)[number]["key"];

// Every evaluator needs this as a literal tuple (for its own request/response
// schema, whatever shape that provider wants it in) - kept here once so a
// second evaluator can't drift from the first on what counts as a valid key.
export const CRITERION_KEYS = RUBRIC_CRITERIA.map((c) => c.key) as [RubricCriterionKey, ...RubricCriterionKey[]];

export type Confidence = "low" | "medium" | "high";

export interface CriterionFeedback {
  criterion: RubricCriterionKey;
  score: 1 | 2 | 3 | 4 | 5;
  evidence: string;
  concern: string;
  suggestion: string;
  confidence: Confidence;
}

export interface Feedback {
  summary: string;
  criteria: CriterionFeedback[];
  overallScore: number;
  generatedBy: string;
}

export function computeOverallScore(criteria: CriterionFeedback[]): number {
  if (criteria.length === 0) return 0;
  const total = criteria.reduce((sum, c) => sum + c.score, 0);
  return Math.round((total / criteria.length) * 10) / 10;
}
