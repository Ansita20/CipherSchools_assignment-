import type Database from "better-sqlite3";
import { Learner } from "../../../domain/learner/Learner";
import type { LearnerRepository } from "../../../domain/learner/LearnerRepository";

interface LearnerRow {
  id: string;
  email: string;
  password_hash: string;
  created_at: string;
}

export class SqliteLearnerRepository implements LearnerRepository {
  constructor(private readonly db: Database.Database) {}

  async save(learner: Learner): Promise<void> {
    const props = learner.toProps();
    this.db
      .prepare(
        `INSERT INTO learners (id, email, password_hash, created_at)
         VALUES (@id, @email, @passwordHash, @createdAt)`,
      )
      .run(props);
  }

  async findById(id: string): Promise<Learner | null> {
    const row = this.db.prepare("SELECT * FROM learners WHERE id = ?").get(id) as LearnerRow | undefined;
    return row ? toLearner(row) : null;
  }

  async findByEmail(email: string): Promise<Learner | null> {
    const row = this.db.prepare("SELECT * FROM learners WHERE email = ?").get(email) as LearnerRow | undefined;
    return row ? toLearner(row) : null;
  }
}

function toLearner(row: LearnerRow): Learner {
  return Learner.fromProps({
    id: row.id,
    email: row.email,
    passwordHash: row.password_hash,
    createdAt: row.created_at,
  });
}
