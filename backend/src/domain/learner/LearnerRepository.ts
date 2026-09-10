import type { Learner } from "./Learner";

export interface LearnerRepository {
  save(learner: Learner): Promise<void>;
  findById(id: string): Promise<Learner | null>;
  findByEmail(email: string): Promise<Learner | null>;
}
