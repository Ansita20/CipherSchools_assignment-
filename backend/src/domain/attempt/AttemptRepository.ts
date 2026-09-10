import type { Attempt } from "./Attempt";

export interface AttemptRepository {
  save(attempt: Attempt): Promise<void>;
  findById(id: string): Promise<Attempt | null>;
  findByLearner(learnerId: string): Promise<Attempt[]>;
}
