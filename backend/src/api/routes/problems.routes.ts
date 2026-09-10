import { Router } from "express";
import type { ProblemService } from "../../application/services/ProblemService";
import { asyncHandler } from "../asyncHandler";

export function problemsRouter(problemService: ProblemService): Router {
  const router = Router();

  router.get(
    "/",
    asyncHandler(async (_req, res) => {
      const problems = await problemService.listAll();
      res.json(problems);
    }),
  );

  router.get(
    "/:id",
    asyncHandler(async (req, res) => {
      const problem = await problemService.getById(req.params.id);
      res.json(problem);
    }),
  );

  return router;
}
