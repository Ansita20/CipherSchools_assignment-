import type { Problem } from "../../domain/problem/Problem";
import type { ProblemRepository } from "../../domain/problem/ProblemRepository";
import { NotFoundError } from "../errors";

export class ProblemService {
  constructor(private readonly problems: ProblemRepository) {}

  listAll(): Promise<Problem[]> {
    return this.problems.findAll();
  }

  async getById(id: string): Promise<Problem> {
    const problem = await this.problems.findById(id);
    if (!problem) throw new NotFoundError(`no problem with id ${id}`);
    return problem;
  }
}
