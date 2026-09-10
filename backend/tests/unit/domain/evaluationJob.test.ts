import { describe, expect, it } from "vitest";
import { EvaluationJob } from "../../../src/domain/evaluation/EvaluationJob";
import type { CompletenessReport } from "../../../src/domain/submission/SubmissionAnalyzer";
import type { Feedback } from "../../../src/domain/evaluation/Feedback";

const okCompleteness: CompletenessReport = {
  isMinimallyComplete: true,
  missingFields: [],
  mentionedConcepts: [],
  missingConcepts: [],
  candidateIdentifiers: [],
};

const sampleFeedback: Feedback = {
  summary: "Solid overall.",
  criteria: [],
  overallScore: 4,
  generatedBy: "test",
};

describe("EvaluationJob", () => {
  it("goes queued -> running -> completed", () => {
    const job = EvaluationJob.queue("submission-1", okCompleteness);
    expect(job.status).toBe("queued");

    job.start();
    expect(job.status).toBe("running");

    job.complete(sampleFeedback);
    expect(job.status).toBe("completed");
    expect(job.feedback).toEqual(sampleFeedback);
    expect(job.completedAt).not.toBeNull();
  });

  it("goes queued -> running -> failed, with the error recorded", () => {
    const job = EvaluationJob.queue("submission-1", okCompleteness);
    job.start();

    job.fail("Claude API rate limit hit - try again shortly");

    expect(job.status).toBe("failed");
    expect(job.error).toMatch(/rate limit/);
  });

  it("can be retried from failed, clearing the error", () => {
    const job = EvaluationJob.queue("submission-1", okCompleteness);
    job.start();
    job.fail("boom");

    job.retry();

    expect(job.status).toBe("queued");
    expect(job.error).toBeNull();
  });

  it("rejects invalid transitions", () => {
    const job = EvaluationJob.queue("submission-1", okCompleteness);

    // can't complete or fail before start()
    expect(() => job.complete(sampleFeedback)).toThrow(/cannot complete/);
    expect(() => job.fail("x")).toThrow(/cannot fail/);

    job.start();
    // can't start twice
    expect(() => job.start()).toThrow(/cannot start/);
    // can't retry something that isn't failed
    expect(() => job.retry()).toThrow(/cannot retry/);
  });

  it("requeues a job stuck running after a restart", () => {
    const job = EvaluationJob.queue("submission-1", okCompleteness);
    job.start();

    job.requeueAfterRestart();

    expect(job.status).toBe("queued");
  });

  it("a job that finished immediately (skipped the AI call) starts completed", () => {
    const job = EvaluationJob.completeImmediately("submission-1", okCompleteness, sampleFeedback);

    expect(job.status).toBe("completed");
    expect(job.feedback).toEqual(sampleFeedback);
  });
});
