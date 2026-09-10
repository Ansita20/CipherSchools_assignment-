import { Attempt } from "../../domain/attempt/Attempt";
import type { AttemptRepository } from "../../domain/attempt/AttemptRepository";
import type { ProblemRepository } from "../../domain/problem/ProblemRepository";
import { NotFoundError } from "../errors";

export class AttemptService {
  constructor(
    private readonly attempts: AttemptRepository,
    private readonly problems: ProblemRepository,
  ) {}

  async start(problemId: string, learnerId: string): Promise<Attempt> {
    const problem = await this.problems.findById(problemId);
    if (!problem) throw new NotFoundError(`no problem with id ${problemId}`);

    const attempt = Attempt.start(problemId, learnerId);
    await this.attempts.save(attempt);
    return attempt;
  }

  async getById(id: string, learnerId: string): Promise<Attempt> {
    const attempt = await this.attempts.findById(id);
    // Someone else's attempt reads as "doesn't exist," same as a made-up
    // id - not a 403, which would confirm the id was valid for someone.
    if (!attempt || attempt.learnerId !== learnerId) throw new NotFoundError(`no attempt with id ${id}`);
    return attempt;
  }

  listForLearner(learnerId: string): Promise<Attempt[]> {
    return this.attempts.findByLearner(learnerId);
  }
}
