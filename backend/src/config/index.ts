import path from "node:path";
import dotenv from "dotenv";

dotenv.config();

export interface Config {
  port: number;
  nodeEnv: string;
  dbPath: string;
  anthropicApiKey: string | undefined;
  corsOrigins: string[];
}

export const config: Config = {
  port: Number(process.env.PORT ?? 4000),
  nodeEnv: process.env.NODE_ENV ?? "development",
  dbPath: path.resolve(process.cwd(), process.env.DB_PATH ?? "./data/app.sqlite"),
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || undefined,
  corsOrigins: (process.env.CORS_ORIGIN ?? "http://localhost:5173")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
};
