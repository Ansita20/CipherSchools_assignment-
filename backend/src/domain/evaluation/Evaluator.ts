import type { Problem } from "../problem/Problem";
import type { CompletenessReport } from "../submission/SubmissionAnalyzer";
import type { Submission } from "../submission/Submission";
import type { Feedback } from "./Feedback";

export interface EvaluationInput {
  problem: Problem;
  submission: Submission;
  // Already computed by SubmissionAnalyzer before this evaluator ever runs
  // (EvaluationService only calls evaluate() once isMinimallyComplete is
  // true). An implementation isn't required to use it, but it's there so
  // an LLM-backed evaluator can ground its prompt in verified facts rather
  // than re-deriving them from the same text.
  completeness: CompletenessReport;
}

// The pluggable strategy for turning a Submission into Feedback.
// ClaudeEvaluator and GeminiEvaluator (infrastructure/ai/) are the
// implementations today. A rule-based evaluator or a human-review queue
// can be added later by implementing this same interface - EvaluationService
// and the queue that drives it don't change either way.
export interface Evaluator {
  readonly name: string;
  evaluate(input: EvaluationInput): Promise<Feedback>;
}
