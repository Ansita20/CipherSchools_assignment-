import type Database from "better-sqlite3";
import type { Problem } from "../../../domain/problem/Problem";
import type { ProblemRepository } from "../../../domain/problem/ProblemRepository";

interface ProblemRow {
  id: string;
  slug: string;
  title: string;
  difficulty: string;
  summary: string;
  requirements: string;
  constraints: string;
  required_concepts: string;
  submission_template: string;
  created_at: string;
}

export class SqliteProblemRepository implements ProblemRepository {
  constructor(private readonly db: Database.Database) {}

  async findAll(): Promise<Problem[]> {
    const rows = this.db.prepare("SELECT * FROM problems ORDER BY created_at").all() as ProblemRow[];
    return rows.map(toProblem);
  }

  async findById(id: string): Promise<Problem | null> {
    const row = this.db.prepare("SELECT * FROM problems WHERE id = ?").get(id) as ProblemRow | undefined;
    return row ? toProblem(row) : null;
  }

  async findBySlug(slug: string): Promise<Problem | null> {
    const row = this.db.prepare("SELECT * FROM problems WHERE slug = ?").get(slug) as ProblemRow | undefined;
    return row ? toProblem(row) : null;
  }

  // Not part of ProblemRepository - problems are seeded, not created
  // through the API, so this is only used by scripts/seed.ts.
  insert(problem: Problem): void {
    this.db
      .prepare(
        `INSERT INTO problems
          (id, slug, title, difficulty, summary, requirements, constraints, required_concepts, submission_template, created_at)
         VALUES
          (@id, @slug, @title, @difficulty, @summary, @requirements, @constraints, @requiredConcepts, @submissionTemplate, @createdAt)
         ON CONFLICT(slug) DO UPDATE SET
          title = excluded.title,
          difficulty = excluded.difficulty,
          summary = excluded.summary,
          requirements = excluded.requirements,
          constraints = excluded.constraints,
          required_concepts = excluded.required_concepts,
          submission_template = excluded.submission_template`,
      )
      .run({
        id: problem.id,
        slug: problem.slug,
        title: problem.title,
        difficulty: problem.difficulty,
        summary: problem.summary,
        requirements: JSON.stringify(problem.requirements),
        constraints: JSON.stringify(problem.constraints),
        requiredConcepts: JSON.stringify(problem.requiredConcepts),
        submissionTemplate: JSON.stringify(problem.submissionTemplate),
        createdAt: problem.createdAt,
      });
  }
}

function toProblem(row: ProblemRow): Problem {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    difficulty: row.difficulty as Problem["difficulty"],
    summary: row.summary,
    requirements: JSON.parse(row.requirements),
    constraints: JSON.parse(row.constraints),
    requiredConcepts: JSON.parse(row.required_concepts),
    submissionTemplate: JSON.parse(row.submission_template),
    createdAt: row.created_at,
  };
}
