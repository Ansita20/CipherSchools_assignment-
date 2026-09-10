import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";

interface LearnerProps {
  id: string;
  email: string;
  passwordHash: string;
  createdAt: string;
}

// A registered practicing user. Password hashing lives here rather than in
// an "infrastructure" layer because there's no external system involved -
// node:crypto's scrypt is part of the runtime, the same way Attempt uses
// node:crypto's randomUUID directly. Avoids a native dependency (bcrypt)
// for a prototype that doesn't need one.
export class Learner {
  readonly id: string;
  readonly email: string;
  readonly createdAt: string;
  private readonly passwordHash: string;

  private constructor(props: LearnerProps) {
    this.id = props.id;
    this.email = props.email;
    this.passwordHash = props.passwordHash;
    this.createdAt = props.createdAt;
  }

  static register(email: string, password: string): Learner {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail.includes("@")) {
      throw new Error("enter a valid email address");
    }
    if (password.length < 8) {
      throw new Error("password must be at least 8 characters");
    }

    return new Learner({
      id: randomUUID(),
      email: normalizedEmail,
      passwordHash: hashPassword(password),
      createdAt: new Date().toISOString(),
    });
  }

  static fromProps(props: LearnerProps): Learner {
    return new Learner(props);
  }

  verifyPassword(password: string): boolean {
    return verifyPasswordHash(password, this.passwordHash);
  }

  toProps(): LearnerProps {
    return { id: this.id, email: this.email, passwordHash: this.passwordHash, createdAt: this.createdAt };
  }
}

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derived}`;
}

function verifyPasswordHash(password: string, stored: string): boolean {
  const [salt, derivedHex] = stored.split(":");
  if (!salt || !derivedHex) return false;

  const candidate = scryptSync(password, salt, 64);
  const expected = Buffer.from(derivedHex, "hex");
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}
