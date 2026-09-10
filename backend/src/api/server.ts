import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenAI } from "@google/genai";
import cookieParser from "cookie-parser";
import cors from "cors";
import express, { type Express } from "express";
import type Database from "better-sqlite3";
import { config } from "../config";
import type { Evaluator } from "../domain/evaluation/Evaluator";
import { openDatabase } from "../infrastructure/db/sqlite";
import { SqliteAttemptRepository } from "../infrastructure/db/repositories/SqliteAttemptRepository";
import { SqliteEvaluationJobRepository } from "../infrastructure/db/repositories/SqliteEvaluationJobRepository";
import { SqliteLearnerRepository } from "../infrastructure/db/repositories/SqliteLearnerRepository";
import { SqliteProblemRepository } from "../infrastructure/db/repositories/SqliteProblemRepository";
import { SqliteSubmissionRepository } from "../infrastructure/db/repositories/SqliteSubmissionRepository";
import { ClaudeEvaluator } from "../infrastructure/ai/ClaudeEvaluator";
import { GeminiEvaluator } from "../infrastructure/ai/GeminiEvaluator";
import { AttemptService } from "../application/services/AttemptService";
import { AuthService } from "../application/services/AuthService";
import { EvaluationService } from "../application/services/EvaluationService";
import { ProblemService } from "../application/services/ProblemService";
import { SubmissionService } from "../application/services/SubmissionService";
import { attemptsRouter } from "./routes/attempts.routes";
import { authRouter } from "./routes/auth.routes";
import { problemsRouter } from "./routes/problems.routes";
import { submissionsRouter } from "./routes/submissions.routes";
import { errorHandler } from "./middleware/errorHandler";
import { requireAuth } from "./middleware/requireAuth";

export interface ServerHandle {
  app: Express;
  db: Database.Database;
  evaluationService: EvaluationService;
}

export interface CreateServerOptions {
  dbPath?: string;
  evaluator?: Evaluator | null;
}

export function createServer(options: CreateServerOptions = {}): ServerHandle {
  const db = openDatabase(options.dbPath ?? config.dbPath);

  const problemRepo = new SqliteProblemRepository(db);
  const attemptRepo = new SqliteAttemptRepository(db);
  const submissionRepo = new SqliteSubmissionRepository(db);
  const jobRepo = new SqliteEvaluationJobRepository(db);
  const learnerRepo = new SqliteLearnerRepository(db);

  const evaluator = options.evaluator !== undefined ? options.evaluator : buildEvaluator();

  const authService = new AuthService(learnerRepo, config.jwtSecret);
  const problemService = new ProblemService(problemRepo);
  const attemptService = new AttemptService(attemptRepo, problemRepo);
  const evaluationService = new EvaluationService(jobRepo, submissionRepo, problemRepo, evaluator);
  const submissionService = new SubmissionService(submissionRepo, attemptRepo, problemRepo, evaluationService);

  const app = express();
  app.use(cors({ origin: config.corsOrigins, credentials: true }));
  app.use(express.json());
  app.use(cookieParser());

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", env: config.nodeEnv, aiEnabled: evaluator !== null, evaluator: evaluator?.name ?? null });
  });

  app.use("/api/auth", authRouter(authService));
  app.use("/api/problems", problemsRouter(problemService));
  app.use("/api/attempts", requireAuth, attemptsRouter(attemptService, submissionService, evaluationService));
  app.use("/api/submissions", requireAuth, submissionsRouter(submissionService, evaluationService));

  app.use(errorHandler);

  return { app, db, evaluationService };
}

// Both AI SDKs retry 5xx/429 internally by default, with backoff that can
// stretch a single evaluate() call out for minutes (the Gemini SDK's
// default is up to 5 attempts, backoff up to 60s each). That silently
// undermines the point of EvaluationJob.retry() - a learner should see a
// failure and decide whether to retry, not stare at a spinner while the
// SDK retries on its own. Both clients are configured to fail fast
// (a bounded timeout, no library-level retries) instead.
const AI_REQUEST_TIMEOUT_MS = 20_000;

// EVAL_PROVIDER picks when both keys are set; otherwise whichever key is
// present wins, Anthropic first. Anyone adding a third provider only needs
// to extend this function and Config - EvaluationService and everything
// downstream of the Evaluator interface stays untouched.
function buildEvaluator(): Evaluator | null {
  const provider = config.evalProvider ?? (config.anthropicApiKey ? "anthropic" : config.geminiApiKey ? "gemini" : null);

  if (provider === "anthropic" && config.anthropicApiKey) {
    const client = new Anthropic({ apiKey: config.anthropicApiKey, timeout: AI_REQUEST_TIMEOUT_MS, maxRetries: 0 });
    return new ClaudeEvaluator(client, config.evalModel);
  }
  if (provider === "gemini" && config.geminiApiKey) {
    const client = new GoogleGenAI({
      apiKey: config.geminiApiKey,
      httpOptions: { timeout: AI_REQUEST_TIMEOUT_MS, retryOptions: { attempts: 1 } },
    });
    return new GeminiEvaluator(client, config.geminiModel);
  }
  return null;
}
