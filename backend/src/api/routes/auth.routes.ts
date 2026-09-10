import { Router, type Response } from "express";
import { config } from "../../config";
import { ValidationError } from "../../application/errors";
import type { AuthService } from "../../application/services/AuthService";
import { SESSION_COOKIE_NAME } from "../../infrastructure/auth/session";
import { asyncHandler } from "../asyncHandler";
import { requireAuth } from "../middleware/requireAuth";

const COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export function authRouter(authService: AuthService): Router {
  const router = Router();

  router.post(
    "/signup",
    asyncHandler(async (req, res) => {
      const { email, password } = req.body as { email?: string; password?: string };
      if (!email || !password) throw new ValidationError("email and password are required");

      const { learner, token } = await authService.signup(email, password);
      setSessionCookie(res, token);
      res.status(201).json({ id: learner.id, email: learner.email });
    }),
  );

  router.post(
    "/login",
    asyncHandler(async (req, res) => {
      const { email, password } = req.body as { email?: string; password?: string };
      if (!email || !password) throw new ValidationError("email and password are required");

      const { learner, token } = await authService.login(email, password);
      setSessionCookie(res, token);
      res.json({ id: learner.id, email: learner.email });
    }),
  );

  router.post("/logout", (_req, res) => {
    res.clearCookie(SESSION_COOKIE_NAME);
    res.status(204).end();
  });

  router.get(
    "/me",
    requireAuth,
    asyncHandler(async (req, res) => {
      const learner = await authService.getById(req.learnerId!);
      if (!learner) {
        res.clearCookie(SESSION_COOKIE_NAME);
        res.status(401).json({ error: "sign in to continue" });
        return;
      }
      res.json({ id: learner.id, email: learner.email });
    }),
  );

  return router;
}

function setSessionCookie(res: Response, token: string): void {
  res.cookie(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: config.nodeEnv === "production",
    maxAge: COOKIE_MAX_AGE_MS,
  });
}
