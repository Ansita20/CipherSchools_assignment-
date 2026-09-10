import type { Problem } from "../../domain/problem/Problem";
import { RUBRIC_CRITERIA } from "../../domain/evaluation/Feedback";
import type { CompletenessReport } from "../../domain/submission/SubmissionAnalyzer";
import type { Submission } from "../../domain/submission/Submission";

// Shared by every AI evaluator - the rubric and the prompt built from it are
// the fixed contract that makes feedback comparable across providers, so
// this is the one place that wording lives.
export const SYSTEM_PROMPT = `You review Low-Level Design submissions from learners practicing for design interviews.

Score every one of these ${RUBRIC_CRITERIA.length} criteria, in this order, using the fixed 1-5 scale below:
${RUBRIC_CRITERIA.map((c) => `- ${c.key}: ${c.description}`).join("\n")}

1 = missing or contradicts the requirements. 3 = present but shallow or has a real gap. 5 = solid and clearly reasoned.

You'll be given a "Deterministic analysis" block above the submission. It was computed by simple text rules (word counts, substring matches, a regex scan for compound identifiers like FeeCalculator), not by another model. Treat it as verified fact and don't contradict it - if it lists "ChangeDispenser" as a detected identifier, don't say no abstractions were introduced; if it lists "Ticket" as missing, you can factor that into requirement_understanding without re-scanning the text yourself to check. It's deliberately incomplete (it won't catch a single-word class name like "Vehicle" as an "identifier," for instance) - use your own reading for everything it doesn't cover, but don't re-litigate what it does cover.

Rules:
- Judge the design that's actually written down, not what a strong learner would probably have meant. If a section is thin, say so and score it accordingly - don't fill in the gaps yourself.
- "evidence" must point at something the learner actually wrote, not a restatement of the requirements.
- There is more than one good design for any of these problems. Don't penalize a valid approach for not matching the one you'd have picked.
- Keep "concern" and "suggestion" specific to this submission. Generic SOLID-principle advice that would apply to any submission is not useful feedback.
- Respond with JSON only, matching the given schema exactly.`;

export function buildUserPrompt(problem: Problem, submission: Submission, completeness: CompletenessReport): string {
  const sections = submission.content.sections
    .map((section) => {
      const field = problem.submissionTemplate.find((f) => f.key === section.key);
      const label = field?.label ?? section.key;
      return `### ${label}\n${section.text.trim() || "(left blank)"}`;
    })
    .join("\n\n");

  return `## Problem: ${problem.title} (${problem.difficulty})

${problem.summary}

Requirements:
${problem.requirements.map((r) => `- ${r}`).join("\n")}

Constraints:
${problem.constraints.map((c) => `- ${c}`).join("\n")}

## Deterministic analysis (verified - see system prompt)
- Required concepts mentioned in the text: ${listOrNone(completeness.mentionedConcepts)}
- Required concepts NOT found in the text: ${listOrNone(completeness.missingConcepts)}
- Compound identifiers detected (regex scan, not exhaustive): ${listOrNone(completeness.candidateIdentifiers)}

## Learner's submission

${sections}`;
}

function listOrNone(items: string[]): string {
  return items.length > 0 ? items.join(", ") : "none";
}
