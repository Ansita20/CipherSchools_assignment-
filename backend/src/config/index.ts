import path from "node:path";
import dotenv from "dotenv";

dotenv.config();

export type EvalProvider = "anthropic" | "gemini";

export interface Config {
  port: number;
  nodeEnv: string;
  dbPath: string;
  anthropicApiKey: string | undefined;
  evalModel: string;
  geminiApiKey: string | undefined;
  geminiModel: string;
  // Which evaluator to use when more than one API key is configured.
  // Unset means "whichever key is present" - see api/server.ts.
  evalProvider: EvalProvider | undefined;
  corsOrigins: string[];
  jwtSecret: string;
}

export const config: Config = {
  port: Number(process.env.PORT ?? 4000),
  nodeEnv: process.env.NODE_ENV ?? "development",
  dbPath: path.resolve(process.cwd(), process.env.DB_PATH ?? "./data/app.sqlite"),
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || undefined,
  evalModel: process.env.EVAL_MODEL || "claude-opus-5",
  geminiApiKey: process.env.GEMINI_API_KEY || undefined,
  geminiModel: process.env.GEMINI_EVAL_MODEL || "gemini-3.5-flash-lite",
  evalProvider: process.env.EVAL_PROVIDER === "anthropic" || process.env.EVAL_PROVIDER === "gemini" ? process.env.EVAL_PROVIDER : undefined,
  corsOrigins: (process.env.CORS_ORIGIN ?? "http://localhost:5173")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
  // Falls back to a fixed dev-only value so `npm run dev` works with zero
  // setup; anything beyond a local prototype needs a real JWT_SECRET, or
  // every session becomes forgeable with a value anyone can read here.
  jwtSecret: process.env.JWT_SECRET || "dev-only-insecure-secret-set-JWT_SECRET-for-anything-real",
};
