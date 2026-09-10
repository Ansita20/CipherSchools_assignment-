import type { NextFunction, Request, Response } from "express";
import { config } from "../../config";
import { AuthenticationError } from "../../application/errors";
import { SESSION_COOKIE_NAME, verifySessionToken } from "../../infrastructure/auth/session";

declare global {
  namespace Express {
    interface Request {
      learnerId?: string;
    }
  }
}

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const token = req.cookies?.[SESSION_COOKIE_NAME] as string | undefined;
  const learnerId = token ? verifySessionToken(token, config.jwtSecret) : null;

  if (!learnerId) {
    next(new AuthenticationError("sign in to continue"));
    return;
  }

  req.learnerId = learnerId;
  next();
}
