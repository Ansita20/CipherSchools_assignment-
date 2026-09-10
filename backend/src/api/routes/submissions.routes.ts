import { Router } from "express";
import { ValidationError } from "../../application/errors";
import type { EvaluationJob } from "../../domain/evaluation/EvaluationJob";
import type { EvaluationService } from "../../application/services/EvaluationService";
import type { SubmissionService } from "../../application/services/SubmissionService";
import { asyncHandler } from "../asyncHandler";

// Mounted behind requireAuth in api/server.ts, so req.learnerId is always
// set by the time these handlers run.
export function submissionsRouter(submissionService: SubmissionService, evaluationService: EvaluationService): Router {
  const router = Router();

  router.post(
    "/",
    asyncHandler(async (req, res) => {
      const { attemptId, sections } = req.body as {
        attemptId?: string;
        sections?: { key: string; text: string }[];
      };
      if (!attemptId) throw new ValidationError("attemptId is required");
      if (!Array.isArray(sections)) throw new ValidationError("sections must be an array");

      const { submission, job } = await submissionService.submit(attemptId, sections, req.learnerId!);
      res.status(201).json({ submission, evaluation: toEvaluationView(job) });
    }),
  );

  router.get(
    "/:id",
    asyncHandler(async (req, res) => {
      const { submission, job } = await submissionService.getStatus(req.params.id, req.learnerId!);
      res.json({ submission, evaluation: toEvaluationView(job) });
    }),
  );

  // Manual retry for a failed evaluation - see EvaluationJob for why this
  // is explicit rather than an automatic retry loop.
  router.post(
    "/:id/retry",
    asyncHandler(async (req, res) => {
      const { job } = await submissionService.getStatus(req.params.id, req.learnerId!);
      const retried = await evaluationService.retry(job.id);
      res.json({ evaluation: toEvaluationView(retried) });
    }),
  );

  return router;
}

function toEvaluationView(job: EvaluationJob) {
  return {
    id: job.id,
    status: job.status,
    feedback: job.feedback,
    error: job.error,
    completeness: job.completeness,
    createdAt: job.createdAt,
    completedAt: job.completedAt,
  };
}
