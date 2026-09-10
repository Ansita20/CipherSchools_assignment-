import type { Submission } from "./Submission";

export interface SubmissionRepository {
  save(submission: Submission): Promise<void>;
  findById(id: string): Promise<Submission | null>;
  findByAttempt(attemptId: string): Promise<Submission | null>;
}
