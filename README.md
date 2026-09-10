# LLD Practice Platform

A small prototype for practicing Low-Level Design: pick a problem, write a structured design submission, get rubric-based feedback (deterministic completeness check + AI design review), and track attempts over time.

See [`docs/RESEARCH_NOTE.md`](docs/RESEARCH_NOTE.md) for the problem/market research and [`docs/DESIGN_NOTE.md`](docs/DESIGN_NOTE.md) for the domain model, evaluation approach, and trade-offs. This file is just "how do I run it."

## Stack

- **Backend:** Node.js + TypeScript, Express, SQLite (`better-sqlite3`). AI-assisted feedback via either the Anthropic API (`@anthropic-ai/sdk`) or the Gemini API (`@google/genai`) - both implement the same `Evaluator` interface, so which one runs is a config choice, not a code change. Auth is email/password with `node:crypto` scrypt hashing and a JWT session in an httpOnly cookie (`jsonwebtoken` + `cookie-parser`) - no bcrypt, no session table. Plain domain classes/interfaces, no framework beyond Express - see the Design Note for why.
- **Frontend:** React + Vite + TypeScript, plain CSS (no UI framework).
- **Tests:** Vitest (unit) + Supertest (integration, in-memory SQLite).

It's an npm workspaces monorepo: `backend/` and `frontend/` are separate packages, one `npm install` at the root gets both.

## Running it

```bash
npm install                 # installs both backend and frontend
npm run seed -w backend     # seeds the 3 practice problems into SQLite
npm run dev                 # runs backend (:4000) and frontend (:5173) together
```

Open http://localhost:5173 and sign up with any email/password (8+ characters) - it's a real account (SQLite-backed, password hashed), not a demo login.

Run them separately if you'd rather see each log stream on its own: `npm run dev:backend` / `npm run dev:frontend`.

### Enabling AI feedback

Without any API key the app still runs end-to-end - submissions get deterministic completeness feedback ("you left two fields too short"), and the UI says AI feedback isn't configured. To get real rubric scoring, set **either** key in `backend/.env` (copy from `backend/.env.example`):

```bash
cp backend/.env.example backend/.env
# then set one of:
#   ANTHROPIC_API_KEY=sk-ant-...
#   GEMINI_API_KEY=...
```

If both are set, `EVAL_PROVIDER=anthropic|gemini` picks which one runs; otherwise whichever key is present wins. `EVAL_MODEL` / `GEMINI_EVAL_MODEL` override the default model per provider. Restart `npm run dev` after editing `.env`.

### Tests

```bash
npm run test -w backend
```

52 tests: domain unit tests (`Attempt`, `EvaluationJob`, `Learner`, `SubmissionAnalyzer`, `computeOverallScore`), unit tests for both `ClaudeEvaluator` and `GeminiEvaluator` against stubbed clients (no network/API key needed for either), a session-token unit test, and two integration suites against a real in-memory SQLite database: `auth.api.test.ts` (signup/login/logout, duplicate email, wrong password, protected routes without a session) and `attempts.api.test.ts` (the full practice loop with a fake `Evaluator` - the completeness gate, the queued->completed happy path, the double-submit rejection, the failed->retry path, and cross-learner ownership checks on attempts/submissions).

There's no frontend test suite for this MVP - the practice loop was verified end-to-end in a real browser (problem list -> detail -> workspace -> submit -> feedback -> history) instead; see `AI_USAGE.md` for how.

### Type checking / build

```bash
npm run -w backend typecheck
npm run -w frontend typecheck
npm run build       # tsc for backend, vite build for frontend
```

## Project layout

```
backend/
  src/domain/            entities, value objects, repository & evaluator interfaces (Learner, Attempt, Submission, EvaluationJob...)
  src/application/       use-case services (Auth/Problem/Attempt/Submission/Evaluation)
  src/infrastructure/    SQLite repos, Claude/Gemini evaluators, JWT session signing, the in-memory job queue
  src/api/                Express routes + auth/error middleware
  data/problems/          seed data (Parking Lot, Elevator System, Vending Machine)
  scripts/seed.ts
  tests/
frontend/
  src/pages/              Login/Signup, ProblemList -> ProblemDetail -> AttemptWorkspace -> Feedback -> History
  src/context/AuthContext.tsx   signed-in state, shared via React context
  src/api/client.ts        fetch wrapper (credentials: "include" for the session cookie)
docs/
  RESEARCH_NOTE.md
  DESIGN_NOTE.md
AI_USAGE.md
```

## Known limitations

- **One submission per attempt.** Submitting closes the attempt; iterating means starting a new attempt on the same problem, not editing the old one.
- **Single-process job queue.** In-memory, not durable across a process restart mid-evaluation - though a restart doesn't lose the submission, since `EvaluationService.recoverStuckJobs()` re-queues anything left `queued`/`running` on boot. See the Design Note's "light HLD" section for what would change at real scale.
- **Structured text only.** The domain model (`SubmissionContent` as a discriminated union) is built to add a diagram/code format later without touching `Attempt`/`Problem`/the evaluation pipeline, but only structured text ships in this MVP.
- **Auth is intentionally minimal.** Email/password only - no email verification, no password reset, no OAuth. Sessions are a JWT in an httpOnly cookie with a 7-day expiry and no server-side revocation list, so a compromised token is valid until it expires; fine for a practice prototype, not for anything storing real user data at stake.
- **`npm audit` flags moderate transitive vulnerabilities** in dev-time tooling (`vite`/`vitest`/`esbuild`'s dev server, `qs` via `express`, `react-router`) - all either dev-only exposure or requiring a breaking major-version bump; not addressed given the 2-day scope. Not exploitable in this local prototype.

## AI usage

See [`AI_USAGE.md`](AI_USAGE.md).
