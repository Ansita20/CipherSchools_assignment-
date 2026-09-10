import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createServer, type ServerHandle } from "../../src/api/server";

describe("auth API", () => {
  let handle: ServerHandle;

  beforeEach(() => {
    handle = createServer({ dbPath: ":memory:", evaluator: null });
  });

  afterEach(() => {
    handle.db.close();
  });

  it("signs up, sets a session cookie, and /me reflects the new account", async () => {
    const agent = request.agent(handle.app);

    const signup = await agent.post("/api/auth/signup").send({ email: "new@example.com", password: "correct-horse" });
    expect(signup.status).toBe(201);
    expect(signup.body.email).toBe("new@example.com");
    expect(signup.headers["set-cookie"]).toBeDefined();

    const me = await agent.get("/api/auth/me");
    expect(me.status).toBe(200);
    expect(me.body.email).toBe("new@example.com");
  });

  it("rejects a duplicate signup email", async () => {
    const agent = request.agent(handle.app);
    await agent.post("/api/auth/signup").send({ email: "dup@example.com", password: "correct-horse" });

    const second = await request(handle.app).post("/api/auth/signup").send({ email: "dup@example.com", password: "another-password" });
    expect(second.status).toBe(400);
  });

  it("rejects a password under 8 characters", async () => {
    const res = await request(handle.app).post("/api/auth/signup").send({ email: "short@example.com", password: "abc" });
    expect(res.status).toBe(400);
  });

  it("logs in with the right password and rejects the wrong one", async () => {
    await request(handle.app).post("/api/auth/signup").send({ email: "login@example.com", password: "correct-horse" });

    const wrong = await request(handle.app).post("/api/auth/login").send({ email: "login@example.com", password: "wrong-password" });
    expect(wrong.status).toBe(401);

    const right = request.agent(handle.app);
    const ok = await right.post("/api/auth/login").send({ email: "login@example.com", password: "correct-horse" });
    expect(ok.status).toBe(200);

    const me = await right.get("/api/auth/me");
    expect(me.body.email).toBe("login@example.com");
  });

  it("gives the same error for a nonexistent email as a wrong password", async () => {
    await request(handle.app).post("/api/auth/signup").send({ email: "exists@example.com", password: "correct-horse" });

    const wrongPassword = await request(handle.app).post("/api/auth/login").send({ email: "exists@example.com", password: "nope" });
    const noSuchAccount = await request(handle.app).post("/api/auth/login").send({ email: "nobody@example.com", password: "nope" });

    expect(wrongPassword.status).toBe(401);
    expect(noSuchAccount.status).toBe(401);
    expect(wrongPassword.body.error).toBe(noSuchAccount.body.error);
  });

  it("rejects /me and protected routes without a session", async () => {
    const me = await request(handle.app).get("/api/auth/me");
    expect(me.status).toBe(401);

    const attempts = await request(handle.app).get("/api/attempts");
    expect(attempts.status).toBe(401);
  });

  it("logout clears the session so protected routes reject again", async () => {
    const agent = request.agent(handle.app);
    await agent.post("/api/auth/signup").send({ email: "out@example.com", password: "correct-horse" });
    expect((await agent.get("/api/auth/me")).status).toBe(200);

    await agent.post("/api/auth/logout");

    const me = await agent.get("/api/auth/me");
    expect(me.status).toBe(401);
  });
});
