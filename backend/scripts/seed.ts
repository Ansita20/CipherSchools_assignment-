import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { Difficulty, Problem, SubmissionField } from "../src/domain/problem/Problem";
import { openDatabase } from "../src/infrastructure/db/sqlite";
import { SqliteProblemRepository } from "../src/infrastructure/db/repositories/SqliteProblemRepository";
import { config } from "../src/config";

// Shared by every problem for now - one submission format, one template.
// See Problem.submissionTemplate for why this lives per-problem in the
// domain model even though today every problem happens to use the same one.
const SUBMISSION_TEMPLATE: SubmissionField[] = [
  {
    key: "requirements_assumptions",
    label: "Requirements & assumptions",
    helpText: "What are you assuming about scope, scale, or anything left ambiguous?",
    minWords: 15,
  },
  {
    key: "classes",
    label: "Classes & responsibilities",
    helpText: "List the main classes/interfaces and what each one is responsible for.",
    minWords: 40,
  },
  {
    key: "relationships",
    label: "Relationships & interactions",
    helpText: "How do the classes collaborate? Composition, inheritance, key method calls.",
    minWords: 25,
  },
  {
    key: "tradeoffs",
    label: "Trade-offs & extensibility",
    helpText: "What did you choose not to do, and how would this handle a plausible new requirement?",
    minWords: 25,
  },
];

interface ProblemFile {
  slug: string;
  title: string;
  difficulty: Difficulty;
  summary: string;
  requirements: string[];
  constraints: string[];
  requiredConcepts: string[];
}

function loadProblemFiles(): ProblemFile[] {
  const dir = path.join(__dirname, "../data/problems");
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), "utf-8")) as ProblemFile);
}

function main() {
  const db = openDatabase(config.dbPath);
  const repo = new SqliteProblemRepository(db);

  const files = loadProblemFiles();
  for (const file of files) {
    const problem: Problem = {
      id: randomUUID(),
      slug: file.slug,
      title: file.title,
      difficulty: file.difficulty,
      summary: file.summary,
      requirements: file.requirements,
      constraints: file.constraints,
      requiredConcepts: file.requiredConcepts,
      submissionTemplate: SUBMISSION_TEMPLATE,
      createdAt: new Date().toISOString(),
    };
    repo.insert(problem);
    console.log(`seeded: ${problem.slug}`);
  }

  db.close();
}

main();
