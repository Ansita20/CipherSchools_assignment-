import type { EvaluationJob } from "./EvaluationJob";

export interface EvaluationJobRepository {
  save(job: EvaluationJob): Promise<void>;
  findById(id: string): Promise<EvaluationJob | null>;
  findBySubmission(submissionId: string): Promise<EvaluationJob | null>;
  // Jobs left mid-flight by a process restart - used to re-enqueue on boot
  // instead of leaving them stuck forever.
  findQueuedOrRunning(): Promise<EvaluationJob[]>;
}
