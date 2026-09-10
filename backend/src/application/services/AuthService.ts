import { Learner } from "../../domain/learner/Learner";
import type { LearnerRepository } from "../../domain/learner/LearnerRepository";
import { signSessionToken } from "../../infrastructure/auth/session";
import { AuthenticationError, ValidationError } from "../errors";

export interface AuthResult {
  learner: Learner;
  token: string;
}

export class AuthService {
  constructor(
    private readonly learners: LearnerRepository,
    private readonly jwtSecret: string,
  ) {}

  async signup(email: string, password: string): Promise<AuthResult> {
    const normalizedEmail = email.trim().toLowerCase();
    const existing = await this.learners.findByEmail(normalizedEmail);
    if (existing) {
      throw new ValidationError("an account with this email already exists");
    }

    let learner: Learner;
    try {
      learner = Learner.register(email, password);
    } catch (err) {
      throw new ValidationError(err instanceof Error ? err.message : "invalid signup details");
    }

    await this.learners.save(learner);
    return { learner, token: signSessionToken(learner.id, this.jwtSecret) };
  }

  async login(email: string, password: string): Promise<AuthResult> {
    const learner = await this.learners.findByEmail(email.trim().toLowerCase());
    // Same message either way - a wrong password and a nonexistent account
    // should look identical from the outside, or the error itself becomes
    // a way to enumerate registered emails.
    if (!learner || !learner.verifyPassword(password)) {
      throw new AuthenticationError("invalid email or password");
    }
    return { learner, token: signSessionToken(learner.id, this.jwtSecret) };
  }

  getById(learnerId: string): Promise<Learner | null> {
    return this.learners.findById(learnerId);
  }
}
