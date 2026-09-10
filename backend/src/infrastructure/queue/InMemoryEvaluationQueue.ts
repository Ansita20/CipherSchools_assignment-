export type JobHandler = (jobId: string) => Promise<void>;

// Runs evaluation jobs one at a time in-process. That's deliberately modest
// for a prototype - it keeps writes to the single SQLite connection
// serialized, and it's enough to answer "what happens if evaluation takes
// time" without pulling in Redis/SQS. It does NOT survive a process
// restart: a job that's still "queued" or "running" when the process dies
// is picked back up by EvaluationService.recoverStuckJobs() on the next
// boot, not by this class. Swapping this for a durable queue later only
// means implementing this same enqueue() contract differently.
export class InMemoryEvaluationQueue {
  private readonly pending: string[] = [];
  private draining = false;

  constructor(private readonly handler: JobHandler) {}

  enqueue(jobId: string): void {
    this.pending.push(jobId);
    void this.drain();
  }

  private async drain(): Promise<void> {
    if (this.draining) return;
    this.draining = true;

    while (this.pending.length > 0) {
      const jobId = this.pending.shift()!;
      try {
        await this.handler(jobId);
      } catch (err) {
        // The handler is expected to catch its own evaluator failures and
        // record them on the job - reaching here means something else
        // broke, so just log it rather than take the queue down.
        console.error(`unhandled error processing evaluation job ${jobId}`, err);
      }
    }

    this.draining = false;
  }
}
