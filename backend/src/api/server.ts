import cors from "cors";
import express, { type Express } from "express";
import { config } from "../config";

// Wires the Express app. Domain routes (problems/attempts/submissions) are
// mounted here as they're implemented; for now this exposes a health check
// so the config/dotenv/CORS wiring can be verified end-to-end from the
// frontend before the domain layer exists.
export function createServer(): Express {
  const app = express();

  app.use(cors({ origin: config.corsOrigins }));
  app.use(express.json());

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", env: config.nodeEnv });
  });

  return app;
}
