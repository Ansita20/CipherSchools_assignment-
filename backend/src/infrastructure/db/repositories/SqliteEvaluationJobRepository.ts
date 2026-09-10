import type Database from "better-sqlite3";
import { EvaluationJob, type EvaluationStatus } from "../../../domain/evaluation/EvaluationJob";
import type { EvaluationJobRepository } from "../../../domain/evaluation/EvaluationJobRepository";
import type { Feedback } from "../../../domain/evaluation/Feedback";
import type { CompletenessReport } from "../../../domain/submission/SubmissionAnalyzer";

interface EvaluationJobRow {
  id: string;
  submission_id: string;
  status: string;
  completeness: string;
  feedback: string | null;
  error: string | null;
  created_at: string;
  completed_at: string | null;
}

export class SqliteEvaluationJobRepository implements EvaluationJobRepository {
  constructor(private readonly db: Database.Database) {}

  async save(job: EvaluationJob): Promise<void> {
    const props = job.toProps();
    this.db
      .prepare(
        `INSERT INTO evaluation_jobs (id, submission_id, status, completeness, feedback, error, created_at, completed_at)
         VALUES (@id, @submissionId, @status, @completeness, @feedback, @error, @createdAt, @completedAt)
         ON CONFLICT(id) DO UPDATE SET
           status = excluded.status,
           feedback = excluded.feedback,
           error = excluded.error,
           completed_at = excluded.completed_at`,
      )
      .run({
        id: props.id,
        submissionId: props.submissionId,
        status: props.status,
        completeness: JSON.stringify(props.completeness),
        feedback: props.feedback ? JSON.stringify(props.feedback) : null,
        error: props.error,
        createdAt: props.createdAt,
        completedAt: props.completedAt,
      });
  }

  async findById(id: string): Promise<EvaluationJob | null> {
    const row = this.db.prepare("SELECT * FROM evaluation_jobs WHERE id = ?").get(id) as EvaluationJobRow | undefined;
    return row ? toJob(row) : null;
  }

  async findBySubmission(submissionId: string): Promise<EvaluationJob | null> {
    const row = this.db
      .prepare("SELECT * FROM evaluation_jobs WHERE submission_id = ?")
      .get(submissionId) as EvaluationJobRow | undefined;
    return row ? toJob(row) : null;
  }

  async findQueuedOrRunning(): Promise<EvaluationJob[]> {
    const rows = this.db
      .prepare("SELECT * FROM evaluation_jobs WHERE status IN ('queued', 'running')")
      .all() as EvaluationJobRow[];
    return rows.map(toJob);
  }
}

function toJob(row: EvaluationJobRow): EvaluationJob {
  return EvaluationJob.fromProps({
    id: row.id,
    submissionId: row.submission_id,
    status: row.status as EvaluationStatus,
    completeness: JSON.parse(row.completeness) as CompletenessReport,
    feedback: row.feedback ? (JSON.parse(row.feedback) as Feedback) : null,
    error: row.error,
    createdAt: row.created_at,
    completedAt: row.completed_at,
  });
}
