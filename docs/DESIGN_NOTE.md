# Design Note

## Scope

In: email/password accounts, problem selection, a structured-text submission form, a two-stage evaluation pipeline (deterministic completeness check, then an AI rubric evaluator), polling for results, and full attempt history per learner.

Out (deliberately, for a 2-day MVP): anything beyond password auth (email verification, password reset, OAuth), diagram/code submission formats (the domain model leaves room for them - see "Extensibility" - but only structured text ships), multiple submissions per attempt (submitting closes the attempt; "try again" starts a new one), and any deployment beyond a single-process monolith with a SQLite file.

## User flow

```
Sign up / log in -> Problem list -> Problem detail -> Start attempt -> Workspace (fill structured-text sections)
   -> Submit -> Feedback page (polls while queued/running) -> Try again (new attempt) or History
```

`History` lists every attempt a learner has made, across every problem, most recent first, with a link into that attempt's feedback (or "Continue" if it's still in progress). That's what turns this from "solve it once" into "practice."

## Why structured text, not a diagram tool or free prose

The research note found existing tools split between full UML editors (real authoring overhead before you've said anything about your design) and free-text/chat (impossible to evaluate consistently - "did they cover encapsulation" depends on where in a paragraph it's buried, if anywhere). Structured text is the middle ground: one field per thing that's actually judged (`requirements_assumptions`, `classes`, `relationships`, `tradeoffs`). It's cheap for the learner to produce, and it's enough evidence for both the deterministic check and the AI evaluator to reason about a specific dimension without guessing which paragraph is about coupling.

## Domain model

`backend/src/domain/` - this is where the actual design decisions live.

- **`Learner`** (`domain/learner/Learner.ts`) - the registered account. Owns its own password hashing (`node:crypto` scrypt + a random salt, verified with a timing-safe comparison) the same way `Attempt` owns its own id generation - there's no external system involved, so there's no reason to push that into an "infrastructure" layer. `Learner.register()` enforces its own invariants (valid-looking email, 8+ character password) rather than trusting the caller to have checked.
- **`Problem`** (`domain/problem`) - a value object: requirements, constraints, `requiredConcepts` (for the completeness check), and a `submissionTemplate: SubmissionField[]` that drives the workspace form. Problems are seeded, not created through the API - `ProblemRepository` is read-only by design.
- **`Attempt`** (`domain/attempt`) - a small entity with real behavior: `Attempt.start()` and `attempt.markSubmitted()`. The invariant that matters is "an attempt can only be submitted once," enforced inside the class, not by callers remembering to check.
- **`Submission`** (`domain/submission`) - an immutable snapshot, not an entity with behavior. Its `content` is a discriminated union on `format` (`{ format: "structured-text", sections: [...] }` today) so a future submission format is a new union variant, not a rewrite - see "Extensibility."
- **`SubmissionAnalyzer`** (`domain/submission/SubmissionAnalyzer.ts`) - a free function, `analyzeCompleteness(problem, content)`, not a class. It doesn't need identity or state, just a pure transformation, so it isn't one. Produces a `CompletenessReport`: which fields are too short, and which of the problem's `requiredConcepts` never appear in the text (advisory only - see below).
- **`Evaluator`** (`domain/evaluation/Evaluator.ts`) - the one interface in this codebase that exists purely for extensibility: `evaluate(input) => Promise<Feedback>`. Two implementations ship: `ClaudeEvaluator` and `GeminiEvaluator`.
- **`EvaluationJob`** (`domain/evaluation/EvaluationJob.ts`) - an entity whose whole job is enforcing a state machine (`queued -> running -> completed|failed`, plus `retry()` and `requeueAfterRestart()`). This is where "what happens if evaluation fails or takes time" actually lives - see below.
- **`Feedback` / `RUBRIC_CRITERIA`** (`domain/evaluation/Feedback.ts`) - the fixed, shared rubric (eight criteria - requirement understanding, responsibility assignment, coupling & cohesion, encapsulation & interfaces, abstraction & patterns, extensibility, edge cases & testability, explanation quality). Fixed on purpose: comparable feedback across attempts is what makes History useful, and it's what the assignment's own guidance recommends over an unconstrained "is this good?" prompt.

Application services (`backend/src/application/services/`) are thin orchestrators over these - `AuthService`, `ProblemService`, `AttemptService`, `SubmissionService`, `EvaluationService` - each owns one use case and talks to the domain through repository interfaces, never through concrete SQLite classes directly.

Authentication itself is deliberately boring: `POST /api/auth/signup|login` sets a JWT in an httpOnly cookie (`infrastructure/auth/session.ts`); `requireAuth` middleware verifies it and attaches `req.learnerId` before any attempt/submission route runs. `AttemptService.getById` and `SubmissionService.submit`/`getStatus` all check `attempt.learnerId === req.learnerId` and throw the same `NotFoundError` a made-up id would - someone else's attempt should look identical to a nonexistent one, not confirm the id was valid for somebody.

## Evaluation approach: deterministic first, AI second

`SubmissionService.submit()` always runs `analyzeCompleteness()` synchronously - it's free and instant. `EvaluationService.startEvaluation()` then branches:

1. **Not minimally complete** (a required field is too short) -> feedback is synthesized directly from the completeness report ("Classes & responsibilities: wrote 4 words, needs at least 40") and the job is marked `completed` immediately. No AI call.
2. **No evaluator configured** (neither `ANTHROPIC_API_KEY` nor `GEMINI_API_KEY` set) -> same immediate-completion path, with a feedback message saying so. The app is fully demoable without any API key.
3. **Complete, evaluator available** -> the job is queued and picked up by `InMemoryEvaluationQueue`, which calls whichever `Evaluator` `api/server.ts` wired up (`ClaudeEvaluator` or `GeminiEvaluator` - see "Extensibility" below).

This split answers the assignment's question directly: *structural completeness* ("did you write something for every field, at reasonable length") is 100% deterministic - there's no ambiguity in a word count, and it's wasteful to spend a model call finding out a field is empty. *Design judgment* (is this responsibility assignment actually clean, is this abstraction earning its complexity) needs a reasoner, because there's more than one valid answer and a fixed rule can't tell "no reservations in v1" apart from "forgot to think about reservations."

`requiredConcepts` (e.g. `Vehicle`, `ParkingSpot`, `Ticket` for Parking Lot) are checked but never gate anything - they're advisory. A learner who calls it `Slot` instead of `ParkingSpot` hasn't necessarily designed anything worse; keyword absence isn't proof of a missing idea, so it's information, not a penalty.

That check's output doesn't stop at being shown to the learner, though - `CompletenessReport` (mentioned/missing required concepts, plus a regex scan for compound identifiers like `FeeCalculator` or `ChangeDispenser`) is passed into the AI evaluator's prompt as a "Deterministic analysis" block, with an explicit instruction to treat it as verified and not re-derive it. The reasoning: an LLM re-scanning the same text for "did they mention a Ticket" or "did they introduce any abstractions" is exactly where it can confidently say something wrong ("no interfaces used" when one plainly is) - so the parts that are actually deterministic (does this substring appear, does this regex match) are computed once, correctly, by code, and the model is told to build its *judgment* (is the coupling here actually a problem, is this abstraction earning its complexity) on top of facts it doesn't have to re-verify. Verified live: a submission that named `FeeCalculator` but omitted `Ticket` came back with `missingConcepts: ["Ticket"]` and `candidateIdentifiers: ["FeeCalculator", ...]` computed correctly, and the model's feedback matched both facts precisely - it flagged the missing `Ticket` with a specific consequence (can't compute duration on exit) rather than a vague ding, and correctly treated `FeeCalculator` as an existing abstraction rather than claiming none existed.

Both evaluators ask for structured JSON rather than free text - `ClaudeEvaluator` via `output_config.format` + a Zod schema (`@anthropic-ai/sdk`'s `messages.parse`, which validates for us), `GeminiEvaluator` via `responseJsonSchema` (`@google/genai`'s own JSON-schema format, then validated against the same shape with Zod on our side, since Gemini has no equivalent auto-parse step). Either way `Feedback` always has the same shape (`summary`, and one `{ criterion, score, evidence, concern, suggestion, confidence }` per rubric criterion) and the frontend never has to parse prose to find a score. The shared prompt (`infrastructure/ai/rubricPrompt.ts`) explicitly tells the model to judge what's written, not what a strong learner would probably have meant, and to keep `concern`/`suggestion` specific to the submission rather than generic SOLID-principle advice - both aimed at making the feedback something a learner can act on, not a lecture.

## What happens when evaluation is slow or fails

`POST /submissions` returns as soon as the job is *queued* (or completed immediately, for the two cases above) - it never blocks on the AI call. The frontend polls `GET /submissions/:id` every 1.5s while status is `queued`/`running`. If the evaluator throws (rate limit, bad API key, malformed model output), `EvaluationJob.fail(message)` records it and the frontend shows the error with a manual **Retry** button - not a silent retry loop, so a systemic outage doesn't turn into a background hammering loop, and the learner isn't left wondering whether anything is happening.

`InMemoryEvaluationQueue` is exactly that - an array and a drain loop, single-process, no persistence of its own. If the process restarts while a job is `queued` or `running`, `EvaluationService.recoverStuckJobs()` (called once at boot) finds those jobs in SQLite and re-enqueues them, so a crash loses at most the in-flight evaluation, never the submission itself (which is persisted before the job is ever created).

One thing that only showed up under a real, overloaded API (verified live against Gemini's `503 UNAVAILABLE` during a genuine high-demand window): both AI SDKs retry 5xx/429 internally by default, and the Gemini SDK's default backoff (up to 5 attempts, delay doubling toward a 60s cap) can stretch a single `evaluate()` call out to several minutes before it ever throws - which silently defeats the explicit-retry design above, since the learner just sees a spinner with no idea whether anything is happening. Both clients (`api/server.ts`'s `buildEvaluator()`) are configured with a 20s request timeout and library-level retries disabled (`maxRetries: 0` / `retryOptions: { attempts: 1 }`), so a failure surfaces in seconds, and retrying is the learner's explicit choice via the **Retry** button, not the SDK's.

## Extensibility: the two change tests

**A new submission format** (e.g. a diagram upload): add a variant to the `SubmissionContent` union, add a template-rendering branch in the frontend workspace, and teach `SubmissionAnalyzer` and the prompt-builder (`infrastructure/ai/rubricPrompt.ts`) to read the new shape. `Attempt`, `Problem`, `EvaluationJob`, and the API routes don't change - they already operate on `Submission` and `Feedback`, not on `structured-text` specifically.

**A second evaluation approach:** this one isn't hypothetical - `GeminiEvaluator` (`infrastructure/ai/GeminiEvaluator.ts`, using `@google/genai`) ships alongside `ClaudeEvaluator` as a second, independent implementation of `Evaluator`. Both consume the same `SYSTEM_PROMPT`/`buildUserPrompt` and the same fixed rubric from `domain/evaluation/Feedback.ts`, and each validates its own provider's response against that shape before it ever becomes a `Feedback` object - so a learner gets the same eight criteria, the same score range, and the same `{evidence, concern, suggestion}` structure no matter which one ran. `api/server.ts`'s `buildEvaluator()` picks between them from config (`EVAL_PROVIDER`, or whichever API key is present); `EvaluationJob`, the queue, the retry endpoint, and every route needed zero changes to support the second provider. A rule-based evaluator or a human-review queue would slot in the same way. `EvaluationService` could be extended further to run more than one evaluator per job and merge results, but that's speculative for now and isn't built - one evaluator per job, chosen by config, is enough for the MVP.

## Key trade-offs / known limitations

- **Auth is real but minimal.** Email/password with scrypt hashing and a JWT session cookie, not a `localStorage` UUID standing in for identity - but no email verification, no password reset, no revocation list (a session is valid until its 7-day expiry, full stop). Enough to make "your attempts" mean something across devices; not enough for anything with real user data at stake.
- **One submission per attempt.** Simpler state machine, but it means there's no "revise within the same attempt" - only a fresh attempt. Worth adding if real usage shows people wanting to iterate before finalizing.
- **Domain objects doubling as the wire format.** Routes largely return `attempt.toProps()` / raw `Submission` objects rather than dedicated DTOs. Keeps the code small for an MVP; a stricter version would decouple the API shape from the domain shape so one can change without the other.
- **Single-process queue.** Deliberately not Redis/SQS - see the Scope Boundary in the assignment. The trade-off is explicit: crash-safety via `recoverStuckJobs()`, but no cross-process distribution.
- **One AI evaluator per job.** Two providers are supported (Claude, Gemini), configurable via env var, but only one runs per submission - no cost/quality cascade (e.g. a cheap first pass, expensive only on borderline cases) and no cross-checking two models against each other. Reasonable for the traffic this is built for, not for scale.

## If this had to handle more users or slower AI evaluation (light HLD)

The monolith boundary that would move first is the queue: swap `InMemoryEvaluationQueue` for something durable (e.g. a Postgres-backed job table, or a real queue) behind the exact same `enqueue(jobId)` contract - `EvaluationService` wouldn't change. SQLite would move to Postgres for concurrent writers. The API layer is already stateless per-request (learner identity travels in a header, not a session), so it horizontally scales behind a load balancer without any change; only the queue and the database are shared state that need to become genuinely shared services instead of in-process ones. None of this needs to happen for the MVP - it's just where the seams already are.
