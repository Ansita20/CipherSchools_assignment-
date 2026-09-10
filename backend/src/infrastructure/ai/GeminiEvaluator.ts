import { ApiError, GoogleGenAI, Type } from "@google/genai";
import { z } from "zod";
import type { Evaluator, EvaluationInput } from "../../domain/evaluation/Evaluator";
import { CRITERION_KEYS, RUBRIC_CRITERIA, computeOverallScore, type Feedback } from "../../domain/evaluation/Feedback";
import { SYSTEM_PROMPT, buildUserPrompt } from "./rubricPrompt";

// Mirrors ClaudeEvaluator's schema, but Gemini's structured-output config
// wants its own JSON-schema shape (the `Type` enum) rather than a Zod
// object - and unlike Anthropic's `messages.parse`, nothing here validates
// the response for us, so it's still worth checking with Zod once we get
// the JSON string back.
const RESPONSE_JSON_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    summary: {
      type: Type.STRING,
      description: "Two or three sentences on the overall design, written to the learner.",
    },
    criteria: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          criterion: { type: Type.STRING, enum: [...CRITERION_KEYS] },
          score: { type: Type.INTEGER, description: "Integer from 1 to 5." },
          evidence: { type: Type.STRING, description: "A short quote or paraphrase from the submission that the score is based on." },
          concern: { type: Type.STRING, description: "The main weakness for this criterion. Empty string if there isn't one." },
          suggestion: { type: Type.STRING, description: "One concrete thing the learner could change." },
          confidence: { type: Type.STRING, enum: ["low", "medium", "high"] },
        },
        required: ["criterion", "score", "evidence", "concern", "suggestion", "confidence"],
        propertyOrdering: ["criterion", "score", "evidence", "concern", "suggestion", "confidence"],
      },
    },
  },
  required: ["summary", "criteria"],
  propertyOrdering: ["summary", "criteria"],
};

const ResponseSchema = z.object({
  summary: z.string(),
  criteria: z
    .array(
      z.object({
        criterion: z.enum(CRITERION_KEYS),
        score: z.number().int().min(1).max(5) as z.ZodType<1 | 2 | 3 | 4 | 5>,
        evidence: z.string(),
        concern: z.string(),
        suggestion: z.string(),
        confidence: z.enum(["low", "medium", "high"]),
      }),
    )
    .length(RUBRIC_CRITERIA.length),
});

export class GeminiEvaluator implements Evaluator {
  readonly name = "gemini-lld-rubric-v1";

  constructor(
    private readonly client: GoogleGenAI,
    private readonly model = "gemini-3.5-flash-lite",
  ) {}

  async evaluate({ problem, submission, completeness }: EvaluationInput): Promise<Feedback> {
    const userPrompt = buildUserPrompt(problem, submission, completeness);

    let text: string | undefined;
    try {
      const response = await this.client.models.generateContent({
        model: this.model,
        contents: userPrompt,
        config: {
          systemInstruction: SYSTEM_PROMPT,
          responseMimeType: "application/json",
          responseJsonSchema: RESPONSE_JSON_SCHEMA,
        },
      });
      text = response.text;
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 401 || err.status === 403) {
          throw new Error("Gemini API rejected the configured API key");
        }
        if (err.status === 429) {
          throw new Error("Gemini API rate limit hit - try again shortly");
        }
        throw new Error(`Gemini API error (${err.status}): ${err.message}`);
      }
      throw err;
    }

    if (!text) {
      throw new Error("Gemini returned no content - the response may have been blocked by a safety filter");
    }

    const parsed = ResponseSchema.safeParse(JSON.parse(text));
    if (!parsed.success) {
      throw new Error("Gemini did not return a response matching the rubric schema");
    }

    const { summary, criteria } = parsed.data;
    return {
      summary,
      criteria,
      overallScore: computeOverallScore(criteria),
      generatedBy: this.name,
    };
  }
}
