import type { Evaluator } from "../../domain/evaluation/Evaluator";
import { EvaluationJob } from "../../domain/evaluation/EvaluationJob";
import type { EvaluationJobRepository } from "../../domain/evaluation/EvaluationJobRepository";
import type { Feedback } from "../../domain/evaluation/Feedback";
import type { ProblemRepository } from "../../domain/problem/ProblemRepository";
import type { CompletenessReport } from "../../domain/submission/SubmissionAnalyzer";
import type { Submission } from "../../domain/submission/Submission";
import type { SubmissionRepository } from "../../domain/submission/SubmissionRepository";
import { InMemoryEvaluationQueue } from "../../infrastructure/queue/InMemoryEvaluationQueue";
import { NotFoundError, ValidationError } from "../errors";

// Decides how a Submission gets its Feedback, and runs that process async
// where it involves the LLMEvaluator. See EvaluationJob for the state
// machine this drives.
export class EvaluationService {
  private readonly queue: InMemoryEvaluationQueue;

  constructor(
    private readonly jobs: EvaluationJobRepository,
    private readonly submissions: SubmissionRepository,
    private readonly problems: ProblemRepository,
    private readonly evaluator: Evaluator | null,
  ) {
    this.queue = new InMemoryEvaluationQueue((jobId) => this.runJob(jobId));
  }

  async startEvaluation(submission: Submission, completeness: CompletenessReport): Promise<EvaluationJob> {
    if (!completeness.isMinimallyComplete) {
      const job = EvaluationJob.completeImmediately(submission.id, completeness, incompleteFeedback(completeness));
      await this.jobs.save(job);
      return job;
    }

    if (!this.evaluator) {
      const job = EvaluationJob.completeImmediately(submission.id, completeness, noEvaluatorFeedback(completeness));
      await this.jobs.save(job);
      return job;
    }

    const job = EvaluationJob.queue(submission.id, completeness);
    await this.jobs.save(job);
    this.queue.enqueue(job.id);
    return job;
  }

  getBySubmission(submissionId: string): Promise<EvaluationJob | null> {
    return this.jobs.findBySubmission(submissionId);
  }

  async retry(jobId: string): Promise<EvaluationJob> {
    if (!this.evaluator) {
      throw new ValidationError("no evaluator configured - set ANTHROPIC_API_KEY to enable retries");
    }
    const job = await this.jobs.findById(jobId);
    if (!job) throw new NotFoundError(`no evaluation job ${jobId}`);

    job.retry();
    await this.jobs.save(job);
    this.queue.enqueue(job.id);
    return job;
  }

  // Called once at startup. A job stuck in "queued" or "running" only
  // happens because the process died mid-evaluation - nothing else can
  // leave it there - so every such job gets picked back up.
  async recoverStuckJobs(): Promise<void> {
    const stuck = await this.jobs.findQueuedOrRunning();
    for (const job of stuck) {
      job.requeueAfterRestart();
      await this.jobs.save(job);
      this.queue.enqueue(job.id);
    }
  }

  private async runJob(jobId: string): Promise<void> {
    const job = await this.jobs.findById(jobId);
    if (!job || !this.evaluator) return;

    const submission = await this.submissions.findById(job.submissionId);
    const problem = submission ? await this.problems.findById(submission.problemId) : null;

    job.start();
    await this.jobs.save(job);

    if (!submission || !problem) {
      job.fail("submission or problem no longer exists");
      await this.jobs.save(job);
      return;
    }

    try {
      const feedback = await this.evaluator.evaluate({ problem, submission, completeness: job.completeness });
      job.complete(feedback);
    } catch (err) {
      job.fail(err instanceof Error ? err.message : "evaluation failed for an unknown reason");
    }
    await this.jobs.save(job);
  }
}

function incompleteFeedback(report: CompletenessReport): Feedback {
  const missing = report.missingFields.map((f) => `${f.label} (${f.reason})`).join("; ");
  return {
    summary: `This submission isn't complete enough to review yet - ${missing}. Fill these in and submit again for full feedback.`,
    criteria: [],
    overallScore: 0,
    generatedBy: "completeness-check",
  };
}

function noEvaluatorFeedback(report: CompletenessReport): Feedback {
  const note = report.missingConcepts.length > 0
    ? ` It doesn't mention: ${report.missingConcepts.join(", ")} - worth double-checking those were considered.`
    : "";
  return {
    summary: `The submission is complete enough to review, but AI-assisted feedback isn't configured for this deployment (no ANTHROPIC_API_KEY set).${note}`,
    criteria: [],
    overallScore: 0,
    generatedBy: "completeness-check",
  };
}
