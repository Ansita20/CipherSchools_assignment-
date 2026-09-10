import { randomUUID } from "node:crypto";

// A learner's answer for one field of the structured-text template
// (e.g. key "classes" -> the text they wrote about classes/responsibilities).
export interface SubmissionSection {
  key: string;
  text: string;
}

// Submission content is a discriminated union on `format` so a future format
// (e.g. a diagram upload) is a new variant here plus a new branch wherever
// content is read - not a change to Attempt, Problem, or the evaluation
// pipeline. Only "structured-text" exists today.
export type SubmissionContent = {
  format: "structured-text";
  sections: SubmissionSection[];
};

export interface Submission {
  readonly id: string;
  readonly attemptId: string;
  readonly problemId: string;
  readonly content: SubmissionContent;
  readonly createdAt: string;
}

export function createSubmission(
  attemptId: string,
  problemId: string,
  content: SubmissionContent,
): Submission {
  return {
    id: randomUUID(),
    attemptId,
    problemId,
    content,
    createdAt: new Date().toISOString(),
  };
}
