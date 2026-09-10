import { randomUUID } from "node:crypto";
import type { AttemptStatus } from "./AttemptStatus";

interface AttemptProps {
  id: string;
  problemId: string;
  learnerId: string;
  status: AttemptStatus;
  startedAt: string;
  submittedAt: string | null;
}

// One learner's session against one Problem. For this MVP an attempt holds
// at most one submission - "try again" means starting a new Attempt, not
// resubmitting into the same one. That keeps history simple: each row in
// the learner's history is exactly one attempt -> one outcome.
export class Attempt {
  readonly id: string;
  readonly problemId: string;
  readonly learnerId: string;
  readonly startedAt: string;
  private _status: AttemptStatus;
  private _submittedAt: string | null;

  private constructor(props: AttemptProps) {
    this.id = props.id;
    this.problemId = props.problemId;
    this.learnerId = props.learnerId;
    this.startedAt = props.startedAt;
    this._status = props.status;
    this._submittedAt = props.submittedAt;
  }

  static start(problemId: string, learnerId: string): Attempt {
    return new Attempt({
      id: randomUUID(),
      problemId,
      learnerId,
      status: "in_progress",
      startedAt: new Date().toISOString(),
      submittedAt: null,
    });
  }

  static fromProps(props: AttemptProps): Attempt {
    return new Attempt(props);
  }

  get status(): AttemptStatus {
    return this._status;
  }

  get submittedAt(): string | null {
    return this._submittedAt;
  }

  markSubmitted(): void {
    if (this._status === "submitted") {
      throw new Error(`attempt ${this.id} has already been submitted`);
    }
    this._status = "submitted";
    this._submittedAt = new Date().toISOString();
  }

  toProps(): AttemptProps {
    return {
      id: this.id,
      problemId: this.problemId,
      learnerId: this.learnerId,
      status: this._status,
      startedAt: this.startedAt,
      submittedAt: this._submittedAt,
    };
  }
}
