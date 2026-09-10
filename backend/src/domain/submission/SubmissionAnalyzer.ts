import type { Problem } from "../problem/Problem";
import type { SubmissionContent } from "./Submission";

export interface MissingField {
  key: string;
  label: string;
  reason: string;
}

export interface CompletenessReport {
  isMinimallyComplete: boolean;
  missingFields: MissingField[];
  // Concepts from the problem that showed up in the submission text, and
  // ones that didn't. Advisory, not a gate - a learner can use different
  // naming ("Slot" instead of "ParkingSpot") and still have a sound design.
  // Fed into the AI evaluator's prompt as a verified fact (see
  // infrastructure/ai/rubricPrompt.ts) so it doesn't have to re-derive
  // "did they mention Ticket" itself and risk getting it wrong.
  mentionedConcepts: string[];
  missingConcepts: string[];
  // Compound identifier-like terms detected in the text (e.g.
  // "FeeCalculator", "ChangeDispenser") - a regex scan, not a parser, so
  // it only catches names with an internal capital letter. A single
  // capitalized word ("Vehicle") is indistinguishable from an ordinary
  // capitalized English word by this method, so those aren't included
  // here - requiredConcepts already covers the domain's expected
  // single-word entities. This exists to catch the *extra* abstractions a
  // learner introduces beyond what the problem asks for.
  candidateIdentifiers: string[];
}

// Cheap, synchronous, free. Runs on every submission before anything is
// queued for AI evaluation. Its first job is to catch the case where a
// submission is too thin to say anything meaningful about - so we don't
// spend an LLM call telling someone "please write more" when a word count
// can say that for free. Its second job is to hand the AI evaluator facts
// it can trust instead of facts it has to re-derive from the same text -
// re-derivation is exactly where an LLM can confidently get something
// wrong ("no interfaces used" when one plainly is).
export function analyzeCompleteness(problem: Problem, content: SubmissionContent): CompletenessReport {
  const missingFields: MissingField[] = [];

  for (const field of problem.submissionTemplate) {
    const section = content.sections.find((s) => s.key === field.key);
    const words = section ? wordCount(section.text) : 0;
    if (words < field.minWords) {
      missingFields.push({
        key: field.key,
        label: field.label,
        reason: `wrote ${words} word${words === 1 ? "" : "s"}, needs at least ${field.minWords}`,
      });
    }
  }

  const allText = content.sections.map((s) => s.text).join(" ");
  const lowerText = allText.toLowerCase();
  const mentionedConcepts = problem.requiredConcepts.filter((concept) => lowerText.includes(concept.toLowerCase()));
  const missingConcepts = problem.requiredConcepts.filter((concept) => !lowerText.includes(concept.toLowerCase()));

  return {
    isMinimallyComplete: missingFields.length === 0,
    missingFields,
    mentionedConcepts,
    missingConcepts,
    candidateIdentifiers: extractCandidateIdentifiers(allText),
  };
}

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

// Matches a capital letter, some lowercase/digits, then another capital -
// i.e. a compound PascalCase word ("ParkingSpot", "FeeCalculator"). Plain
// English prose essentially never produces a mid-word capital by accident,
// so this has very few false positives, unlike trying to guess at
// single-word class names.
const IDENTIFIER_PATTERN = /\b[A-Z][a-z0-9]+[A-Z][a-zA-Z0-9]*\b/g;

function extractCandidateIdentifiers(text: string): string[] {
  const matches = text.match(IDENTIFIER_PATTERN) ?? [];
  return [...new Set(matches)].sort();
}
