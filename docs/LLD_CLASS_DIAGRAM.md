# Low-Level Design (LLD) & Class Diagram

This document provides a comprehensive Low-Level Design (LLD) specification of the **LLD Practice Platform**, covering class structures, properties, methods, design patterns, relationships, and execution lifecycles across the Domain, Application, Infrastructure, and Presentation layers.

---

## 1. Clean Architecture & Layered Overview

The project adheres to **Domain-Driven Design (DDD)** and **Clean Architecture (Hexagonal / Ports & Adapters)** principles:

```mermaid
graph TD
    subgraph Presentation ["Presentation Layer (API & UI)"]
        Routes["Express Routers<br/>(auth, problems, attempts, submissions)"]
        Middleware["Middleware<br/>(requireAuth, errorHandler)"]
        ReactUI["React Frontend<br/>(Pages, AuthContext, API Client)"]
    end

    subgraph Application ["Application Layer (Use Cases)"]
        AuthService["AuthService"]
        ProblemService["ProblemService"]
        AttemptService["AttemptService"]
        SubmissionService["SubmissionService"]
        EvaluationService["EvaluationService"]
    end

    subgraph Domain ["Domain Layer (Core Business Rules)"]
        Learner["Learner"]
        Problem["Problem & SubmissionField"]
        Attempt["Attempt"]
        Submission["Submission & SubmissionContent"]
        EvaluationJob["EvaluationJob"]
        SubmissionAnalyzer["SubmissionAnalyzer"]
        EvaluatorPort["Evaluator (Interface)"]
        Feedback["Feedback & RubricCriteria"]
        RepoPorts["Repository Interfaces<br/>(LearnerRepo, ProblemRepo, AttemptRepo,<br/>SubmissionRepo, EvaluationJobRepo)"]
    end

    subgraph Infrastructure ["Infrastructure Layer (Adapters & External)"]
        SqliteRepos["SQLite Repositories<br/>(SqliteLearnerRepo, SqliteProblemRepo, etc.)"]
        AIAdapters["AI Evaluators<br/>(ClaudeEvaluator, GeminiEvaluator)"]
        Queue["InMemoryEvaluationQueue"]
        AuthSession["Session Crypto (JWT, Scrypt)"]
        SQLiteDB[("SQLite Database")]
    end

    ReactUI --> Routes
    Routes --> AuthService
    Routes --> ProblemService
    Routes --> AttemptService
    Routes --> SubmissionService
    Routes --> EvaluationService

    AuthService --> RepoPorts
    ProblemService --> RepoPorts
    AttemptService --> RepoPorts
    SubmissionService --> RepoPorts
    SubmissionService --> SubmissionAnalyzer
    SubmissionService --> EvaluationService
    EvaluationService --> RepoPorts
    EvaluationService --> EvaluatorPort
    EvaluationService --> Queue

    SqliteRepos -.->|implements| RepoPorts
    SqliteRepos --> SQLiteDB
    AIAdapters -.->|implements| EvaluatorPort
    Queue --> EvaluationService
```

---

## 2. Core Domain Model Class Diagram

The Domain layer is purely algorithmic and object-oriented TypeScript with no external framework dependencies.

```mermaid
classDiagram
    direction TB

    class Learner {
        +string id
        +string email
        +string createdAt
        -string passwordHash
        +register(email, password)$ Learner
        +fromProps(props)$ Learner
        +verifyPassword(password) boolean
        +toProps() LearnerProps
    }

    class Problem {
        +string id
        +string slug
        +string title
        +Difficulty difficulty
        +string summary
        +string[] requirements
        +string[] constraints
        +string[] requiredConcepts
        +SubmissionField[] submissionTemplate
        +string createdAt
    }

    class SubmissionField {
        +string key
        +string label
        +string helpText
        +number minWords
    }

    class Attempt {
        +string id
        +string problemId
        +string learnerId
        +string startedAt
        -AttemptStatus _status
        -string submittedAt
        +start(problemId, learnerId)$ Attempt
        +fromProps(props)$ Attempt
        +get status() AttemptStatus
        +get submittedAt() string
        +markSubmitted() void
        +toProps() AttemptProps
    }

    class Submission {
        +string id
        +string attemptId
        +string problemId
        +SubmissionContent content
        +string createdAt
    }

    class SubmissionSection {
        +string key
        +string text
    }

    class SubmissionContent {
        +string format
        +SubmissionSection[] sections
    }

    class EvaluationJob {
        +string id
        +string submissionId
        +string createdAt
        +CompletenessReport completeness
        -EvaluationStatus _status
        -Feedback _feedback
        -string _error
        -string _completedAt
        +completeImmediately(submissionId, completeness, feedback)$ EvaluationJob
        +queue(submissionId, completeness)$ EvaluationJob
        +fromProps(props)$ EvaluationJob
        +get status() EvaluationStatus
        +get feedback() Feedback
        +get error() string
        +get completedAt() string
        +start() void
        +complete(feedback) void
        +fail(error) void
        +retry() void
        +requeueAfterRestart() void
        +toProps() EvaluationJobProps
    }

    class Feedback {
        +string summary
        +CriterionFeedback[] criteria
        +number overallScore
        +string generatedBy
    }

    class CriterionFeedback {
        +RubricCriterionKey criterion
        +number score
        +string evidence
        +string concern
        +string suggestion
        +Confidence confidence
    }

    class CompletenessReport {
        +boolean isMinimallyComplete
        +MissingField[] missingFields
        +string[] mentionedConcepts
        +string[] missingConcepts
        +string[] candidateIdentifiers
    }

    class SubmissionAnalyzer {
        <<Utility / Function Module>>
        +analyzeCompleteness(problem, content) CompletenessReport
        -wordCount(text) number
        -extractCandidateIdentifiers(text) string[]
    }

    Problem "1" *-- "many" SubmissionField : defines template
    Attempt "many" --> "1" Learner : belongs to
    Attempt "many" --> "1" Problem : targets
    Submission "1" -- "1" Attempt : belongs to
    Submission "1" *-- "1" SubmissionContent : contains
    SubmissionContent "1" *-- "many" SubmissionSection : contains
    EvaluationJob "1" -- "1" Submission : reviews
    EvaluationJob "1" *-- "0..1" Feedback : produces
    EvaluationJob "1" *-- "1" CompletenessReport : embeds
    Feedback "1" *-- "8" CriterionFeedback : contains
    SubmissionAnalyzer ..> CompletenessReport : produces
    SubmissionAnalyzer ..> Problem : checks against
    SubmissionAnalyzer ..> SubmissionContent : inspects
```

---

## 3. Application Services & Repository Ports

The Application layer contains use case handlers (services) that coordinate business entities and interact with persistence via ports (repository interfaces).

```mermaid
classDiagram
    direction TB

    %% Service Classes
    class AuthService {
        -LearnerRepository learners
        -string jwtSecret
        +signup(email, password) Promise~AuthResult~
        +login(email, password) Promise~AuthResult~
        +getById(learnerId) Promise~Learner~
    }

    class ProblemService {
        -ProblemRepository problems
        +listAll() Promise~Problem[]~
        +getById(id) Promise~Problem~
    }

    class AttemptService {
        -AttemptRepository attempts
        -ProblemRepository problems
        +start(problemId, learnerId) Promise~Attempt~
        +getById(id, learnerId) Promise~Attempt~
        +listForLearner(learnerId) Promise~Attempt[]~
    }

    class SubmissionService {
        -SubmissionRepository submissions
        -AttemptRepository attempts
        -ProblemRepository problems
        -EvaluationService evaluationService
        +submit(attemptId, sections, learnerId) Promise~SubmitResult~
        +getStatus(submissionId, learnerId) Promise~SubmitResult~
        +getByAttempt(attemptId) Promise~Submission~
    }

    class EvaluationService {
        -EvaluationJobRepository jobs
        -SubmissionRepository submissions
        -ProblemRepository problems
        -Evaluator evaluator
        -InMemoryEvaluationQueue queue
        +startEvaluation(submission, completeness) Promise~EvaluationJob~
        +getBySubmission(submissionId) Promise~EvaluationJob~
        +retry(jobId) Promise~EvaluationJob~
        +recoverStuckJobs() Promise~void~
        -runJob(jobId) Promise~void~
    }

    %% Interfaces (Ports)
    class LearnerRepository {
        <<interface>>
        +save(learner) Promise~void~
        +findById(id) Promise~Learner~
        +findByEmail(email) Promise~Learner~
    }

    class ProblemRepository {
        <<interface>>
        +findAll() Promise~Problem[]~
        +findById(id) Promise~Problem~
        +findBySlug(slug) Promise~Problem~
    }

    class AttemptRepository {
        <<interface>>
        +save(attempt) Promise~void~
        +findById(id) Promise~Attempt~
        +findByLearner(learnerId) Promise~Attempt[]~
    }

    class SubmissionRepository {
        <<interface>>
        +save(submission) Promise~void~
        +findById(id) Promise~Submission~
        +findByAttempt(attemptId) Promise~Submission~
    }

    class EvaluationJobRepository {
        <<interface>>
        +save(job) Promise~void~
        +findById(id) Promise~EvaluationJob~
        +findBySubmission(submissionId) Promise~EvaluationJob~
        +findQueuedOrRunning() Promise~EvaluationJob[]~
    }

    class Evaluator {
        <<interface>>
        +string name
        +evaluate(input) Promise~Feedback~
    }

    class InMemoryEvaluationQueue {
        -string[] pending
        -boolean draining
        -JobHandler handler
        +enqueue(jobId) void
        -drain() Promise~void~
    }

    AuthService --> LearnerRepository
    ProblemService --> ProblemRepository
    AttemptService --> AttemptRepository
    AttemptService --> ProblemRepository
    SubmissionService --> SubmissionRepository
    SubmissionService --> AttemptRepository
    SubmissionService --> ProblemRepository
    SubmissionService --> EvaluationService
    EvaluationService --> EvaluationJobRepository
    EvaluationService --> SubmissionRepository
    EvaluationService --> ProblemRepository
    EvaluationService --> Evaluator
    EvaluationService *-- InMemoryEvaluationQueue
```

---

## 4. Infrastructure Adapters (Database & AI Implementations)

The Infrastructure layer implements the domain interfaces (Ports) using concrete technologies (better-sqlite3, Anthropic Claude SDK, Google Gemini SDK).

```mermaid
classDiagram
    direction TB

    class LearnerRepository {
        <<interface>>
    }
    class ProblemRepository {
        <<interface>>
    }
    class AttemptRepository {
        <<interface>>
    }
    class SubmissionRepository {
        <<interface>>
    }
    class EvaluationJobRepository {
        <<interface>>
    }
    class Evaluator {
        <<interface>>
        +string name
        +evaluate(input) Promise~Feedback~
    }

    class SqliteLearnerRepository {
        -Database db
        +save(learner) Promise~void~
        +findById(id) Promise~Learner~
        +findByEmail(email) Promise~Learner~
    }

    class SqliteProblemRepository {
        -Database db
        +findAll() Promise~Problem[]~
        +findById(id) Promise~Problem~
        +findBySlug(slug) Promise~Problem~
        +insert(problem) void
    }

    class SqliteAttemptRepository {
        -Database db
        +save(attempt) Promise~void~
        +findById(id) Promise~Attempt~
        +findByLearner(learnerId) Promise~Attempt[]~
    }

    class SqliteSubmissionRepository {
        -Database db
        +save(submission) Promise~void~
        +findById(id) Promise~Submission~
        +findByAttempt(attemptId) Promise~Submission~
    }

    class SqliteEvaluationJobRepository {
        -Database db
        +save(job) Promise~void~
        +findById(id) Promise~EvaluationJob~
        +findBySubmission(submissionId) Promise~EvaluationJob~
        +findQueuedOrRunning() Promise~EvaluationJob[]~
    }

    class ClaudeEvaluator {
        +string name = "claude-lld-rubric-v1"
        -Anthropic client
        -string model
        +evaluate(input) Promise~Feedback~
    }

    class GeminiEvaluator {
        +string name = "gemini-lld-rubric-v1"
        -GoogleGenAI client
        -string model
        +evaluate(input) Promise~Feedback~
    }

    SqliteLearnerRepository ..|> LearnerRepository
    SqliteProblemRepository ..|> ProblemRepository
    SqliteAttemptRepository ..|> AttemptRepository
    SqliteSubmissionRepository ..|> SubmissionRepository
    SqliteEvaluationJobRepository ..|> EvaluationJobRepository
    ClaudeEvaluator ..|> Evaluator
    GeminiEvaluator ..|> Evaluator
```

---

## 5. State Machine Lifecycles

### 5.1 Attempt State Machine
Enforces that each practice attempt is single-use, preventing overwrite of history.

```mermaid
stateDiagram-v2
    [*] --> in_progress : Attempt.start(problemId, learnerId)
    in_progress --> submitted : attempt.markSubmitted()<br/>[on SubmissionService.submit]
    submitted --> [*]
    note right of submitted
        Immutable terminal state.
        Resubmission throws ValidationError.
        Learners start a new Attempt to retry.
    end note
```

### 5.2 EvaluationJob State Machine
Tracks evaluation from synchronous completeness triage to asynchronous AI feedback and manual retry.

```mermaid
stateDiagram-v2
    [*] --> completed : completeImmediately()<br/>[Incomplete or No AI Key]
    [*] --> queued : queue(submissionId, completeness)<br/>[Complete + Evaluator Available]

    queued --> running : job.start()<br/>[Picked up by InMemoryQueue]
    running --> completed : job.complete(feedback)<br/>[Evaluator succeeds]
    running --> failed : job.fail(error)<br/>[Timeout, API error, rate limit]

    failed --> queued : job.retry()<br/>[Learner clicks Retry button]
    running --> queued : job.requeueAfterRestart()<br/>[Server recovers on boot]
    queued --> queued : job.requeueAfterRestart()<br/>[Server recovers on boot]

    completed --> [*]
```

---

## 6. End-to-End Submission Sequence Diagram

This diagram explains how classes interact when a learner submits their design:

```mermaid
sequenceDiagram
    autonumber
    actor Learner as Learner (Browser)
    participant SubRouter as submissions.routes
    participant SubService as SubmissionService
    participant AttRepo as AttemptRepository
    participant SubRepo as SubmissionRepository
    participant Analyzer as SubmissionAnalyzer
    participant EvalService as EvaluationService
    participant JobRepo as EvaluationJobRepository
    participant Queue as InMemoryEvaluationQueue
    participant Evaluator as Evaluator (Claude/Gemini)

    Learner->>SubRouter: POST /api/submissions { attemptId, sections }
    SubRouter->>SubService: submit(attemptId, sections, learnerId)
    SubService->>AttRepo: findById(attemptId)
    Note over SubService,AttRepo: Verify attempt ownership & status === "in_progress"

    SubService->>SubRepo: save(submission)
    SubService->>AttRepo: attempt.markSubmitted() + save()

    SubService->>Analyzer: analyzeCompleteness(problem, content)
    Analyzer-->>SubService: CompletenessReport (isMinimallyComplete, missingConcepts, identifiers)

    SubService->>EvalService: startEvaluation(submission, completeness)

    alt Not minimally complete OR no Evaluator configured
        EvalService->>JobRepo: EvaluationJob.completeImmediately(...)
        EvalService-->>SubService: job (status: completed)
    else Minimally complete and Evaluator exists
        EvalService->>JobRepo: EvaluationJob.queue(...)
        EvalService->>Queue: enqueue(job.id)
        EvalService-->>SubService: job (status: queued)
    end

    SubService-->>SubRouter: { submission, job }
    SubRouter-->>Learner: HTTP 201 { submission, evaluation }

    opt Asynchronous Processing (if queued)
        Queue->>EvalService: runJob(jobId)
        EvalService->>JobRepo: job.start() + save()
        EvalService->>Evaluator: evaluate({ problem, submission, completeness })
        alt Success
            Evaluator-->>EvalService: Feedback (8 criteria + overallScore)
            EvalService->>JobRepo: job.complete(feedback) + save()
        else Failure
            Evaluator-->>EvalService: Error (Timeout / 429 / 503)
            EvalService->>JobRepo: job.fail(error) + save()
        end
    end
```

---

## 7. Class Responsibilities & Design Patterns Reference

| Class / Module | Layer | Primary Pattern | Responsibilities & Design Decisions |
| :--- | :--- | :--- | :--- |
| **`Learner`** | Domain | Rich Entity, Factory | Manages account identity. Enforces email format & password length. Performs scrypt hashing and timing-safe verification directly without external infrastructure leaks. |
| **`Problem`** | Domain | Value Object | Read-only problem definition with structured submission fields (`SubmissionField`) and domain keywords (`requiredConcepts`). |
| **`Attempt`** | Domain | Entity, State Machine | Represents a practice session on a problem. Enforces single-submission invariant (`markSubmitted()` raises error if already submitted). |
| **`Submission`** | Domain | Value Object Snapshot | Immutable snapshot of a learner's answers. Uses discriminated union `SubmissionContent` (`format: "structured-text"`) for forward extensibility. |
| **`SubmissionAnalyzer`** | Domain | Pure Function / Domain Service | Evaluates word count per section and extracts PascalCase identifiers (`FeeCalculator`) and problem concepts without calling an LLM. |
| **`EvaluationJob`** | Domain | Entity, State Machine | State machine for evaluation (`queued` $\to$ `running` $\to$ `completed`/`failed`). Handles instant completion, restart recovery, and retries. |
| **`Evaluator`** | Domain | Strategy Interface | Open/Closed interface defining the contract for evaluation (`evaluate(input): Promise<Feedback>`). |
| **`ClaudeEvaluator`** | Infrastructure | Concrete Strategy, Adapter | Evaluates submissions using Anthropic Claude SDK with Zod output format and structured schema. |
| **`GeminiEvaluator`** | Infrastructure | Concrete Strategy, Adapter | Evaluates submissions using Google GenAI SDK with JSON schema + Zod validation. Disables library backoff to fail fast. |
| **`InMemoryEvaluationQueue`**| Infrastructure | Serial Worker Queue | Serializes async evaluation tasks in-process to avoid SQLite database locking. |
| **`AuthService`** | Application | Use Case Orchestrator | Coordinates learner registration, login verification, and JWT session token generation. |
| **`SubmissionService`** | Application | Use Case Orchestrator | Validates submission sections against problem template, persists submission, marks attempt submitted, and triggers evaluation. |
| **`EvaluationService`** | Application | Use Case Orchestrator | Routes evaluation based on completeness, feeds jobs into queue, handles manual retry, and executes restart recovery. |
| **`createServer`** | API / Presentation | Composition Root / DI | Wires dependencies (SQLite connection, repositories, evaluators, services, express routers) together cleanly. |
