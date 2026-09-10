export interface Learner {
  id: string;
  email: string;
}

export type Difficulty = "easy" | "medium" | "hard";

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
  requiredConcepts: string[];
  submissionTemplate: SubmissionField[];
  createdAt: string;
}

export type AttemptStatus = "in_progress" | "submitted";

export interface Attempt {
  id: string;
  problemId: string;
  learnerId: string;
  status: AttemptStatus;
  startedAt: string;
  submittedAt: string | null;
}

export type EvaluationStatus = "queued" | "running" | "completed" | "failed";

export interface AttemptSummary extends Attempt {
  submissionId: string | null;
  evaluation: { status: EvaluationStatus; overallScore: number | null } | null;
}

export interface SubmissionSection {
  key: string;
  text: string;
}

export interface SubmissionContent {
  format: "structured-text";
  sections: SubmissionSection[];
}

export interface Submission {
  id: string;
  attemptId: string;
  problemId: string;
  content: SubmissionContent;
  createdAt: string;
}

export type Confidence = "low" | "medium" | "high";

export interface CriterionFeedback {
  criterion: string;
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

export interface MissingField {
  key: string;
  label: string;
  reason: string;
}

export interface CompletenessReport {
  isMinimallyComplete: boolean;
  missingFields: MissingField[];
  missingConcepts: string[];
}

export interface EvaluationView {
  id: string;
  status: EvaluationStatus;
  feedback: Feedback | null;
  error: string | null;
  completeness: CompletenessReport;
  createdAt: string;
  completedAt: string | null;
}

export interface SubmitResponse {
  submission: Submission;
  evaluation: EvaluationView;
}
