import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod/v4";
import type { Evaluator, EvaluationInput } from "../../domain/evaluation/Evaluator";
import { CRITERION_KEYS, RUBRIC_CRITERIA, computeOverallScore, type Feedback } from "../../domain/evaluation/Feedback";
import { SYSTEM_PROMPT, buildUserPrompt } from "./rubricPrompt";

const CriterionFeedbackSchema = z.object({
  criterion: z.enum(CRITERION_KEYS),
  score: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
  evidence: z.string().describe("A short quote or paraphrase from the submission that the score is based on."),
  concern: z.string().describe("The main weakness for this criterion. Empty string if there isn't one."),
  suggestion: z.string().describe("One concrete thing the learner could change."),
  confidence: z.enum(["low", "medium", "high"]).describe("How confident the model is, given how much the submission actually said about this."),
});

const ResponseSchema = z.object({
  summary: z.string().describe("Two or three sentences on the overall design, written to the learner."),
  criteria: z.array(CriterionFeedbackSchema).length(RUBRIC_CRITERIA.length),
});

export class ClaudeEvaluator implements Evaluator {
  readonly name = "claude-lld-rubric-v1";

  // Takes an already-constructed client rather than an API key so tests
  // can pass a stub instead of hitting the network.
  constructor(
    private readonly client: Anthropic,
    private readonly model = "claude-opus-5",
  ) {}

  async evaluate({ problem, submission, completeness }: EvaluationInput): Promise<Feedback> {
    const userPrompt = buildUserPrompt(problem, submission, completeness);

    let response;
    try {
      response = await this.client.messages.parse({
        model: this.model,
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userPrompt }],
        output_config: { format: zodOutputFormat(ResponseSchema) },
      });
    } catch (err) {
      if (err instanceof Anthropic.AuthenticationError) {
        throw new Error("Claude API rejected the configured API key");
      }
      if (err instanceof Anthropic.RateLimitError) {
        throw new Error("Claude API rate limit hit - try again shortly");
      }
      if (err instanceof Anthropic.APIError) {
        throw new Error(`Claude API error (${err.status}): ${err.message}`);
      }
      throw err;
    }

    if (!response.parsed_output) {
      throw new Error("Claude did not return a response matching the rubric schema");
    }

    const { summary, criteria } = response.parsed_output;
    return {
      summary,
      criteria,
      overallScore: computeOverallScore(criteria),
      generatedBy: this.name,
    };
  }
}
