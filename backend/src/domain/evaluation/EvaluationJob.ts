import { randomUUID } from "node:crypto";
import type { CompletenessReport } from "../submission/SubmissionAnalyzer";
import type { Feedback } from "./Feedback";

export type EvaluationStatus = "queued" | "running" | "completed" | "failed";

interface EvaluationJobProps {
  id: string;
  submissionId: string;
  status: EvaluationStatus;
  completeness: CompletenessReport;
  feedback: Feedback | null;
  error: string | null;
  createdAt: string;
  completedAt: string | null;
}

// Tracks one evaluation attempt from submission to a final outcome. This is
// the piece that answers "what happens if evaluation takes time or fails":
// a submission is never lost because the job exists (and is persisted)
// before any AI call happens, running/failed/completed are distinct states
// the frontend can poll for, and a failed job can be retried explicitly
// instead of retried silently in a loop.
export class EvaluationJob {
  readonly id: string;
  readonly submissionId: string;
  readonly createdAt: string;
  readonly completeness: CompletenessReport;
  private _status: EvaluationStatus;
  private _feedback: Feedback | null;
  private _error: string | null;
  private _completedAt: string | null;

  private constructor(props: EvaluationJobProps) {
    this.id = props.id;
    this.submissionId = props.submissionId;
    this.createdAt = props.createdAt;
    this.completeness = props.completeness;
    this._status = props.status;
    this._feedback = props.feedback;
    this._error = props.error;
    this._completedAt = props.completedAt;
  }

  // A submission that's too thin to say much about skips the AI call
  // entirely and gets its feedback synthesized right away.
  static completeImmediately(submissionId: string, completeness: CompletenessReport, feedback: Feedback): EvaluationJob {
    const now = new Date().toISOString();
    return new EvaluationJob({
      id: randomUUID(),
      submissionId,
      status: "completed",
      completeness,
      feedback,
      error: null,
      createdAt: now,
      completedAt: now,
    });
  }

  static queue(submissionId: string, completeness: CompletenessReport): EvaluationJob {
    return new EvaluationJob({
      id: randomUUID(),
      submissionId,
      status: "queued",
      completeness,
      feedback: null,
      error: null,
      createdAt: new Date().toISOString(),
      completedAt: null,
    });
  }

  static fromProps(props: EvaluationJobProps): EvaluationJob {
    return new EvaluationJob(props);
  }

  get status(): EvaluationStatus {
    return this._status;
  }

  get feedback(): Feedback | null {
    return this._feedback;
  }

  get error(): string | null {
    return this._error;
  }

  get completedAt(): string | null {
    return this._completedAt;
  }

  start(): void {
    if (this._status !== "queued") {
      throw new Error(`evaluation job ${this.id} cannot start from status "${this._status}"`);
    }
    this._status = "running";
  }

  complete(feedback: Feedback): void {
    if (this._status !== "running") {
      throw new Error(`evaluation job ${this.id} cannot complete from status "${this._status}"`);
    }
    this._status = "completed";
    this._feedback = feedback;
    this._completedAt = new Date().toISOString();
  }

  fail(error: string): void {
    if (this._status !== "running") {
      throw new Error(`evaluation job ${this.id} cannot fail from status "${this._status}"`);
    }
    this._status = "failed";
    this._error = error;
    this._completedAt = new Date().toISOString();
  }

  retry(): void {
    if (this._status !== "failed") {
      throw new Error(`evaluation job ${this.id} cannot retry from status "${this._status}"`);
    }
    this._status = "queued";
    this._error = null;
    this._completedAt = null;
  }

  // For jobs left "running" by a process that crashed or restarted mid-
  // evaluation - not part of the normal lifecycle a client can trigger.
  requeueAfterRestart(): void {
    if (this._status !== "queued" && this._status !== "running") {
      throw new Error(`evaluation job ${this.id} cannot be requeued from status "${this._status}"`);
    }
    this._status = "queued";
  }

  toProps(): EvaluationJobProps {
    return {
      id: this.id,
      submissionId: this.submissionId,
      status: this._status,
      completeness: this.completeness,
      feedback: this._feedback,
      error: this._error,
      createdAt: this.createdAt,
      completedAt: this._completedAt,
    };
  }
}
