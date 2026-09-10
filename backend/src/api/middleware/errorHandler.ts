import type { NextFunction, Request, Response } from "express";
import { AuthenticationError, NotFoundError, ValidationError } from "../../application/errors";

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof NotFoundError) {
    res.status(404).json({ error: err.message });
    return;
  }
  if (err instanceof ValidationError) {
    res.status(400).json({ error: err.message });
    return;
  }
  if (err instanceof AuthenticationError) {
    res.status(401).json({ error: err.message });
    return;
  }

  console.error(err);
  res.status(500).json({ error: "internal server error" });
}
