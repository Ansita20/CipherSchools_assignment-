import type Database from "better-sqlite3";
import { Attempt } from "../../../domain/attempt/Attempt";
import type { AttemptRepository } from "../../../domain/attempt/AttemptRepository";
import type { AttemptStatus } from "../../../domain/attempt/AttemptStatus";

interface AttemptRow {
  id: string;
  problem_id: string;
  learner_id: string;
  status: string;
  started_at: string;
  submitted_at: string | null;
}

export class SqliteAttemptRepository implements AttemptRepository {
  constructor(private readonly db: Database.Database) {}

  async save(attempt: Attempt): Promise<void> {
    const props = attempt.toProps();
    this.db
      .prepare(
        `INSERT INTO attempts (id, problem_id, learner_id, status, started_at, submitted_at)
         VALUES (@id, @problemId, @learnerId, @status, @startedAt, @submittedAt)
         ON CONFLICT(id) DO UPDATE SET status = excluded.status, submitted_at = excluded.submitted_at`,
      )
      .run(props);
  }

  async findById(id: string): Promise<Attempt | null> {
    const row = this.db.prepare("SELECT * FROM attempts WHERE id = ?").get(id) as AttemptRow | undefined;
    return row ? toAttempt(row) : null;
  }

  async findByLearner(learnerId: string): Promise<Attempt[]> {
    const rows = this.db
      .prepare("SELECT * FROM attempts WHERE learner_id = ? ORDER BY started_at DESC")
      .all(learnerId) as AttemptRow[];
    return rows.map(toAttempt);
  }
}

function toAttempt(row: AttemptRow): Attempt {
  return Attempt.fromProps({
    id: row.id,
    problemId: row.problem_id,
    learnerId: row.learner_id,
    status: row.status as AttemptStatus,
    startedAt: row.started_at,
    submittedAt: row.submitted_at,
  });
}
