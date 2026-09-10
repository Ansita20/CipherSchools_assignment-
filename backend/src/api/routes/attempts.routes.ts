import { Router } from "express";
import { ValidationError } from "../../application/errors";
import type { AttemptService } from "../../application/services/AttemptService";
import type { EvaluationService } from "../../application/services/EvaluationService";
import type { SubmissionService } from "../../application/services/SubmissionService";
import { asyncHandler } from "../asyncHandler";

// Mounted behind requireAuth in api/server.ts, so req.learnerId is always
// set by the time these handlers run.
export function attemptsRouter(
  attemptService: AttemptService,
  submissionService: SubmissionService,
  evaluationService: EvaluationService,
): Router {
  const router = Router();

  router.post(
    "/",
    asyncHandler(async (req, res) => {
      const { problemId } = req.body as { problemId?: string };
      if (!problemId) throw new ValidationError("problemId is required");

      const attempt = await attemptService.start(problemId, req.learnerId!);
      res.status(201).json(attempt.toProps());
    }),
  );

  router.get(
    "/",
    asyncHandler(async (req, res) => {
      const attempts = await attemptService.listForLearner(req.learnerId!);

      const summaries = await Promise.all(
        attempts.map(async (attempt) => {
          const submission = await submissionService.getByAttempt(attempt.id);
          const job = submission ? await evaluationService.getBySubmission(submission.id) : null;
          return {
            ...attempt.toProps(),
            submissionId: submission?.id ?? null,
            evaluation: job ? { status: job.status, overallScore: job.feedback?.overallScore ?? null } : null,
          };
        }),
      );

      res.json(summaries);
    }),
  );

  router.get(
    "/:id",
    asyncHandler(async (req, res) => {
      const attempt = await attemptService.getById(req.params.id, req.learnerId!);
      const submission = await submissionService.getByAttempt(attempt.id);
      res.json({ ...attempt.toProps(), submission });
    }),
  );

  return router;
}
