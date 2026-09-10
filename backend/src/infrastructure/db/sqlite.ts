import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { config } from "../../config";

// Inlined rather than loaded from a .sql file so `tsc` doesn't need a
// separate copy step to get it into dist/.
const SCHEMA = `
CREATE TABLE IF NOT EXISTS learners (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS problems (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  difficulty TEXT NOT NULL,
  summary TEXT NOT NULL,
  requirements TEXT NOT NULL,
  constraints TEXT NOT NULL,
  required_concepts TEXT NOT NULL,
  submission_template TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS attempts (
  id TEXT PRIMARY KEY,
  problem_id TEXT NOT NULL REFERENCES problems(id),
  learner_id TEXT NOT NULL,
  status TEXT NOT NULL,
  started_at TEXT NOT NULL,
  submitted_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_attempts_learner ON attempts(learner_id);
CREATE INDEX IF NOT EXISTS idx_attempts_problem ON attempts(problem_id);

CREATE TABLE IF NOT EXISTS submissions (
  id TEXT PRIMARY KEY,
  attempt_id TEXT NOT NULL UNIQUE REFERENCES attempts(id),
  problem_id TEXT NOT NULL REFERENCES problems(id),
  content TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS evaluation_jobs (
  id TEXT PRIMARY KEY,
  submission_id TEXT NOT NULL UNIQUE REFERENCES submissions(id),
  status TEXT NOT NULL,
  completeness TEXT NOT NULL,
  feedback TEXT,
  error TEXT,
  created_at TEXT NOT NULL,
  completed_at TEXT
);
`;

export function openDatabase(dbPath: string = config.dbPath): Database.Database {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });

  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(SCHEMA);

  return db;
}
