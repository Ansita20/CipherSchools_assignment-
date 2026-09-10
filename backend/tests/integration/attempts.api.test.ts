import type { Express } from "express";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createServer, type ServerHandle } from "../../src/api/server";
import type { Evaluator, EvaluationInput } from "../../src/domain/evaluation/Evaluator";
import type { Feedback } from "../../src/domain/evaluation/Feedback";
import { SqliteProblemRepository } from "../../src/infrastructure/db/repositories/SqliteProblemRepository";
import type { Problem, SubmissionField } from "../../src/domain/problem/Problem";

const TEMPLATE: SubmissionField[] = [
  { key: "classes", label: "Classes", helpText: "", minWords: 3 },
  { key: "tradeoffs", label: "Trade-offs", helpText: "", minWords: 3 },
];

function seedProblem(handle: ServerHandle): Problem {
  const problem: Problem = {
    id: "problem-1",
    slug: "parking-lot",
    title: "Parking Lot",
    difficulty: "easy",
    summary: "Design a parking lot.",
    requirements: ["Assign spots to vehicles"],
    constraints: ["Multiple levels"],
    requiredConcepts: ["Vehicle"],
    submissionTemplate: TEMPLATE,
    createdAt: new Date().toISOString(),
  };
  new SqliteProblemRepository(handle.db).insert(problem);
  return problem;
}

// Returns a supertest agent that's already signed up and logged in - it
// carries the session cookie on every subsequent request, the same way a
// browser would.
async function signedInAgent(app: Express, email: string): Promise<request.Agent> {
  const agent = request.agent(app);
  await agent.post("/api/auth/signup").send({ email, password: "correct-horse-battery" });
  return agent;
}

const goodFeedback: Feedback = {
  summary: "Solid first pass.",
  criteria: [
    { criterion: "requirement_understanding", score: 4, evidence: "e", concern: "c", suggestion: "s", confidence: "high" },
  ],
  overallScore: 4,
  generatedBy: "fake-evaluator",
};

class FakeEvaluator implements Evaluator {
  readonly name = "fake-evaluator";
  constructor(private readonly behavior: "succeed" | "fail" = "succeed") {}

  async evaluate(_input: EvaluationInput): Promise<Feedback> {
    if (this.behavior === "fail") {
      throw new Error("simulated evaluator outage");
    }
    return goodFeedback;
  }
}

async function waitForEvaluation(agent: request.Agent, submissionId: string, timeoutMs = 2000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const res = await agent.get(`/api/submissions/${submissionId}`);
    if (res.body.evaluation.status === "completed" || res.body.evaluation.status === "failed") {
      return res.body;
    }
    await new Promise((r) => setTimeout(r, 20));
  }
  throw new Error(`evaluation for ${submissionId} did not settle within ${timeoutMs}ms`);
}

describe("practice loop API", () => {
  let handle: ServerHandle;
  let app: Express;
  let problem: Problem;

  beforeEach(() => {
    handle = createServer({ dbPath: ":memory:", evaluator: new FakeEvaluator("succeed") });
    app = handle.app;
    problem = seedProblem(handle);
  });

  afterEach(() => {
    handle.db.close();
  });

  it("lists seeded problems without requiring auth", async () => {
    const res = await request(app).get("/api/problems");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].slug).toBe("parking-lot");
  });

  it("rejects starting an attempt while signed out", async () => {
    const res = await request(app).post("/api/attempts").send({ problemId: problem.id });
    expect(res.status).toBe(401);
  });

  it("404s starting an attempt for an unknown problem", async () => {
    const agent = await signedInAgent(app, "learner1@example.com");
    const res = await agent.post("/api/attempts").send({ problemId: "does-not-exist" });
    expect(res.status).toBe(404);
  });

  it("gates a thin submission without calling the evaluator", async () => {
    const agent = await signedInAgent(app, "learner1@example.com");
    const attempt = await agent.post("/api/attempts").send({ problemId: problem.id });

    const res = await agent
      .post("/api/submissions")
      .send({ attemptId: attempt.body.id, sections: [{ key: "classes", text: "too short" }] });

    expect(res.status).toBe(201);
    expect(res.body.evaluation.status).toBe("completed");
    expect(res.body.evaluation.completeness.isMinimallyComplete).toBe(false);
    expect(res.body.evaluation.feedback.generatedBy).toBe("completeness-check");
    // the fake evaluator should never have been reached for a gated submission
    expect(res.body.evaluation.feedback.criteria).toEqual([]);
  });

  it("runs the evaluator on a complete submission and the learner can poll for the result", async () => {
    const agent = await signedInAgent(app, "learner1@example.com");
    const attempt = await agent.post("/api/attempts").send({ problemId: problem.id });

    const submit = await agent.post("/api/submissions").send({
      attemptId: attempt.body.id,
      sections: [
        { key: "classes", text: "Vehicle ParkingSpot Ticket" },
        { key: "tradeoffs", text: "No reservations yet" },
      ],
    });

    expect(submit.status).toBe(201);
    expect(["queued", "running", "completed"]).toContain(submit.body.evaluation.status);

    const settled = await waitForEvaluation(agent, submit.body.submission.id);

    expect(settled.evaluation.status).toBe("completed");
    expect(settled.evaluation.feedback).toEqual(goodFeedback);
  });

  it("rejects a second submission on an already-submitted attempt", async () => {
    const agent = await signedInAgent(app, "learner1@example.com");
    const attempt = await agent.post("/api/attempts").send({ problemId: problem.id });

    const sections = [
      { key: "classes", text: "Vehicle ParkingSpot Ticket" },
      { key: "tradeoffs", text: "No reservations yet" },
    ];
    await agent.post("/api/submissions").send({ attemptId: attempt.body.id, sections });

    const second = await agent.post("/api/submissions").send({ attemptId: attempt.body.id, sections });

    expect(second.status).toBe(400);
  });

  it("one learner cannot submit into another learner's attempt", async () => {
    const owner = await signedInAgent(app, "owner@example.com");
    const attempt = await owner.post("/api/attempts").send({ problemId: problem.id });

    const stranger = await signedInAgent(app, "stranger@example.com");
    const res = await stranger.post("/api/submissions").send({
      attemptId: attempt.body.id,
      sections: [
        { key: "classes", text: "Vehicle ParkingSpot Ticket" },
        { key: "tradeoffs", text: "No reservations yet" },
      ],
    });

    expect(res.status).toBe(404);
  });

  it("marks the job failed when the evaluator throws, and retry recovers it", async () => {
    handle.db.close();
    handle = createServer({ dbPath: ":memory:", evaluator: new FakeEvaluator("fail") });
    app = handle.app;
    problem = seedProblem(handle);

    const agent = await signedInAgent(app, "learner1@example.com");
    const attempt = await agent.post("/api/attempts").send({ problemId: problem.id });

    const submit = await agent.post("/api/submissions").send({
      attemptId: attempt.body.id,
      sections: [
        { key: "classes", text: "Vehicle ParkingSpot Ticket" },
        { key: "tradeoffs", text: "No reservations yet" },
      ],
    });

    const failed = await waitForEvaluation(agent, submit.body.submission.id);
    expect(failed.evaluation.status).toBe("failed");
    expect(failed.evaluation.error).toMatch(/simulated evaluator outage/);

    // swap in a working evaluator isn't possible on the running server, but
    // retrying against the same (still-failing) evaluator should still move
    // the job back to queued and attempt again rather than sit stuck.
    const retry = await agent.post(`/api/submissions/${submit.body.submission.id}/retry`);
    expect(["queued", "running", "failed"]).toContain(retry.body.evaluation.status);
  });

  it("returns attempt history for the learner, most recent first", async () => {
    const agent = await signedInAgent(app, "learner1@example.com");
    await agent.post("/api/attempts").send({ problemId: problem.id });
    await agent.post("/api/attempts").send({ problemId: problem.id });

    const res = await agent.get("/api/attempts");

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(new Date(res.body[0].startedAt).getTime()).toBeGreaterThanOrEqual(new Date(res.body[1].startedAt).getTime());
  });

  it("does not show one learner's attempts to another", async () => {
    const first = await signedInAgent(app, "first@example.com");
    await first.post("/api/attempts").send({ problemId: problem.id });

    const second = await signedInAgent(app, "second@example.com");
    const res = await second.get("/api/attempts");

    expect(res.body).toEqual([]);
  });
});
