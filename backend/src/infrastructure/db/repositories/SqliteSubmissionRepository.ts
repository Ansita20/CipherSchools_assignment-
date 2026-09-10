import type Database from "better-sqlite3";
import type { Submission, SubmissionContent } from "../../../domain/submission/Submission";
import type { SubmissionRepository } from "../../../domain/submission/SubmissionRepository";

interface SubmissionRow {
  id: string;
  attempt_id: string;
  problem_id: string;
  content: string;
  created_at: string;
}

export class SqliteSubmissionRepository implements SubmissionRepository {
  constructor(private readonly db: Database.Database) {}

  async save(submission: Submission): Promise<void> {
    this.db
      .prepare(
        `INSERT INTO submissions (id, attempt_id, problem_id, content, created_at)
         VALUES (@id, @attemptId, @problemId, @content, @createdAt)`,
      )
      .run({
        id: submission.id,
        attemptId: submission.attemptId,
        problemId: submission.problemId,
        content: JSON.stringify(submission.content),
        createdAt: submission.createdAt,
      });
  }

  async findById(id: string): Promise<Submission | null> {
    const row = this.db.prepare("SELECT * FROM submissions WHERE id = ?").get(id) as SubmissionRow | undefined;
    return row ? toSubmission(row) : null;
  }

  async findByAttempt(attemptId: string): Promise<Submission | null> {
    const row = this.db
      .prepare("SELECT * FROM submissions WHERE attempt_id = ?")
      .get(attemptId) as SubmissionRow | undefined;
    return row ? toSubmission(row) : null;
  }
}

function toSubmission(row: SubmissionRow): Submission {
  return {
    id: row.id,
    attemptId: row.attempt_id,
    problemId: row.problem_id,
    content: JSON.parse(row.content) as SubmissionContent,
    createdAt: row.created_at,
  };
}
