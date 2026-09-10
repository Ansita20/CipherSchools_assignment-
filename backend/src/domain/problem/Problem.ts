export type Difficulty = "easy" | "medium" | "hard";

// One field the learner has to fill in for a structured-text submission.
// Problems define their own template so "classes" means something specific
// to Parking Lot vs Elevator, rather than one generic textarea.
export interface SubmissionField {
  key: string;
  label: string;
  helpText: string;
  minWords: number;
}

export interface Problem {
  id: string;
  slug: string;
  title: string;
  difficulty: Difficulty;
  summary: string;
  requirements: string[];
  constraints: string[];
  // Concepts the deterministic completeness check looks for in the
  // learner's submission before it's worth spending an LLM call on it.
  requiredConcepts: string[];
  submissionTemplate: SubmissionField[];
  createdAt: string;
}
