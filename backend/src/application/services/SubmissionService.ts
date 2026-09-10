import type { AttemptRepository } from "../../domain/attempt/AttemptRepository";
import type { EvaluationJob } from "../../domain/evaluation/EvaluationJob";
import type { ProblemRepository } from "../../domain/problem/ProblemRepository";
import { analyzeCompleteness } from "../../domain/submission/SubmissionAnalyzer";
import { createSubmission, type Submission, type SubmissionSection } from "../../domain/submission/Submission";
import type { SubmissionRepository } from "../../domain/submission/SubmissionRepository";
import { NotFoundError, ValidationError } from "../errors";
import type { EvaluationService } from "./EvaluationService";

export interface SubmitResult {
  submission: Submission;
  job: EvaluationJob;
}

export class SubmissionService {
  constructor(
    private readonly submissions: SubmissionRepository,
    private readonly attempts: AttemptRepository,
    private readonly problems: ProblemRepository,
    private readonly evaluationService: EvaluationService,
  ) {}

  async submit(attemptId: string, sections: SubmissionSection[], learnerId: string): Promise<SubmitResult> {
    const attempt = await this.attempts.findById(attemptId);
    if (!attempt || attempt.learnerId !== learnerId) throw new NotFoundError(`no attempt with id ${attemptId}`);
    if (attempt.status !== "in_progress") {
      throw new ValidationError(`attempt ${attemptId} has already been submitted`);
    }

    const problem = await this.problems.findById(attempt.problemId);
    if (!problem) throw new NotFoundError(`no problem with id ${attempt.problemId}`);

    // Normalize against the problem's template so every expected field is
    // present (even if blank) - that's what makes the completeness check
    // meaningful, and it means the frontend doesn't have to send an entry
    // for a field the learner left untouched.
    const normalizedSections = problem.submissionTemplate.map((field) => ({
      key: field.key,
      text: sections.find((s) => s.key === field.key)?.text ?? "",
    }));

    const submission = createSubmission(attempt.id, problem.id, {
      format: "structured-text",
      sections: normalizedSections,
    });
    await this.submissions.save(submission);

    attempt.markSubmitted();
    await this.attempts.save(attempt);

    const completeness = analyzeCompleteness(problem, submission.content);
    const job = await this.evaluationService.startEvaluation(submission, completeness);

    return { submission, job };
  }

  async getStatus(submissionId: string, learnerId: string): Promise<SubmitResult> {
    const submission = await this.submissions.findById(submissionId);
    if (!submission) throw new NotFoundError(`no submission with id ${submissionId}`);

    const attempt = await this.attempts.findById(submission.attemptId);
    if (!attempt || attempt.learnerId !== learnerId) throw new NotFoundError(`no submission with id ${submissionId}`);

    const job = await this.evaluationService.getBySubmission(submissionId);
    if (!job) throw new NotFoundError(`no evaluation job for submission ${submissionId}`);

    return { submission, job };
  }

  getByAttempt(attemptId: string): Promise<Submission | null> {
    return this.submissions.findByAttempt(attemptId);
  }
}
