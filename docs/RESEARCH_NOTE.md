# Research Note

## The learner problem

Low-Level Design is easy to start and hard to evaluate. A learner can sketch a `ParkingLot` class in twenty minutes, but nothing tells them whether their `Level` class doing both spot-lookup and fee calculation is a coupling problem, whether they've actually covered the stated requirements, or whether their design would survive a follow-up requirement change. Unlike a LeetCode-style problem, there's rarely a single correct answer to check against - so "practice" without feedback just means writing more designs you're equally unsure about, and there's no way to tell if attempt 5 is actually better than attempt 1.

Two questions matter for a practice product, specifically:

- What does a learner need to *submit* for a piece of feedback to be trustworthy, given they could express the same design as a paragraph, a class diagram, or working code?
- What kind of feedback is actually useful when there's more than one valid design - a single "8/10" score teaches nothing; a wall of unstructured prose is hard to act on.

## What's already out there

A short survey of current LLD practice tools and resources (September 2026):

- **[LLDCanvas](https://www.lldcanvas.in/)** - a UML class-diagram editor with a library of pre-wired design patterns, SOLID notes, 110+ curated questions, and a timed "interview mode" with analytics. Strong on *authoring* a diagram; the analytics are about time-on-task and pattern usage, not an explanation of whether the design itself is sound.
- **[Hello Interview](https://www.hellointerview.com/practice/low-level-design)** - guided walkthroughs of classic problems (parking lot, elevator, etc.) with "personalized feedback," which in practice comes from real engineers reviewing submissions. Feedback quality is presumably high, but it doesn't scale to repeated, immediate, low-cost practice the way an automated loop can.
- **[LLD Problems](https://www.lldproblems.com/)** - a chat-based mock-interview simulator with a visual sketching mode; describes analyzing input for "key concepts" and giving instant feedback, but doesn't publish what it's actually scoring or why.
- **[InstaMock](https://instamock.in/lld)**, **CodeZym**, **AlgoMaster.io** - AI mock interviews, machine-coding execution, and curated/filterable question banks with progress tracking, respectively. None of these center on *design-quality* feedback tied to specific rubric dimensions.
- **Educative's "Grokking the LLD Interview," InterviewBit, awesome-low-level-design (GitHub)** - static content: model solutions and write-ups to compare yourself against. No submission, no feedback loop at all - useful for study, not for practice-and-improve.

## The gaps

1. **Feedback is a black box or a single number.** Where automated feedback exists, it's described vaguely ("analyzes for key concepts") rather than as a transparent, consistent rubric the learner can hold their own design against attempt after attempt.
2. **Submission format is all-or-nothing.** Either a full UML diagram tool (real authoring overhead before you've said anything about your design) or unstructured free text/chat (impossible to evaluate consistently, since "did they cover encapsulation" depends entirely on where in a wall of prose it might be buried).
3. **No visible improvement loop.** These tools are mostly organized around a *question bank* (browse, pick, solve, move on), not around a learner's own trajectory on a *specific* problem across multiple attempts. There's nowhere to see "your coupling score went from 2 to 4 over three tries at Parking Lot."
4. **Human review doesn't scale to repetition.** The one tool with credibly good feedback (Hello Interview) depends on people, which caps how often a learner can cheaply retry.

## Product direction

Build a small, focused loop - not a diagram editor, not a mock-interview simulator, not a question bank with model answers:

- **Submission format:** structured text, one field per thing actually being judged (assumptions, classes & responsibilities, relationships, trade-offs) - closer to what a UML tool asks for than free prose, but with none of the diagram-authoring overhead. See the Design Note for why this beats both extremes for an MVP.
- **Feedback:** a fixed, published rubric (eight criteria, each scored with evidence quoted from the submission, a concern, and a concrete suggestion) - so "why did I get a 2 on coupling" always has an answer that points at something the learner actually wrote.
- **Deterministic first, AI second:** a free, instant completeness check runs before any model call - catching "you left three fields blank" without spending a token on it, and reserving AI judgment for the parts that genuinely need it (is this abstraction earning its complexity, not just "is this field non-empty").
- **History as a first-class feature:** every attempt on a problem is kept, so a learner can see their own trend on a problem they've tried more than once - the "attempt → feedback → retry" loop the surveyed tools mostly skip.

Sources: [LLDCanvas](https://www.lldcanvas.in/), [Hello Interview - LLD Guided Practice](https://www.hellointerview.com/practice/low-level-design), [LLD Problems](https://www.lldproblems.com/), [InstaMock LLD](https://instamock.in/lld), [CodeZym](https://codezym.com/), [AlgoMaster.io LLD resource](https://blog.algomaster.io/p/low-level-design-interview-resource), [awesome-low-level-design](https://github.com/ashishps1/awesome-low-level-design), [Educative - Grokking the Low Level Design Interview](https://www.educative.io/courses/grokking-the-low-level-design-interview-using-ood-principles).
