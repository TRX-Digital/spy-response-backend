import { z } from "zod";
import type { KeywordExpansion } from "../types.js";
import { SPY_RESPONSE_STRATEGY_PROMPT } from "../prompts/spy-response-strategy.js";
import { createStructuredResponse } from "./openai-client.js";

const keywordExpansionSchema = z
  .object({
    expandedTerms: z.array(z.string().trim().min(1)).min(6).max(10),
    hashtags: z.array(z.string().trim().min(1)).min(6).max(12),
    commercialIntentTerms: z.array(z.string().trim().min(1)).min(4).max(10),
    relatedQuestions: z.array(z.string().trim().min(1)).min(4).max(10),
  })
  .strict();

const uniqueStrings = (items: string[]) => {
  const seen = new Set<string>();

  return items
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item) => {
      const key = item.toLowerCase();

      if (seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    });
};

const normalizeHashtag = (hashtag: string) => {
  const normalized = hashtag
    .trim()
    .replace(/^#+/, "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^\p{L}\p{N}_]/gu, "")
    .toLowerCase();

  return normalized ? `#${normalized}` : "";
};

function normalizeKeywordExpansion(
  expansion: KeywordExpansion,
): KeywordExpansion {
  return {
    expandedTerms: uniqueStrings(expansion.expandedTerms).slice(0, 10),
    hashtags: uniqueStrings(expansion.hashtags.map(normalizeHashtag))
      .filter(Boolean)
      .slice(0, 12),
    commercialIntentTerms: uniqueStrings(expansion.commercialIntentTerms).slice(
      0,
      10,
    ),
    relatedQuestions: uniqueStrings(expansion.relatedQuestions).slice(0, 10),
  };
}

export async function generateKeywordExpansion(input: {
  topic: string;
  language: string;
  period: string;
}): Promise<KeywordExpansion> {
  const result = await createStructuredResponse({
    schema: keywordExpansionSchema,
    schemaName: "keyword_expansion",
    instructions: [
      SPY_RESPONSE_STRATEGY_PROMPT,
      "Nesta tarefa, gere expansões de busca com intenção comercial e potencial de produto digital. Retorne apenas JSON estruturado conforme o schema.",
    ].join("\n\n"),
    input: JSON.stringify({
      task: "Generate keyword variations for a preliminary product research search.",
      rules: [
        "Use the requested output language.",
        "expandedTerms must contain 6 to 10 related terms.",
        "hashtags must contain 6 to 12 hashtags, without accents and without spaces.",
        "commercialIntentTerms must focus on buying, income, learning, selling, course, method, guide, or similar intent.",
        "relatedQuestions must be questions the target audience could naturally ask.",
        "Do not invent volume, views, trend, or demand metrics.",
        "Generate variations only; do not claim that the terms are real measured trends.",
        "Prefer terms that help evaluate offers, VSL angles, paid traffic viability, audience pains, and product ideas.",
      ],
      input,
    }),
  });

  return normalizeKeywordExpansion(result);
}
