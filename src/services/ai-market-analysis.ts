import { z } from "zod";
import type {
  ContentAnalysis,
  ContentAnalysisInput,
  KeywordExpansion,
  MarketDiagnosis,
  MockSignals,
} from "../types.js";
import {
  createStructuredResponse,
  deepOpenAIModel,
  defaultOpenAIModel,
} from "./openai-client.js";

const stringList = z.array(z.string().trim().min(1)).min(3).max(8);

const marketDiagnosisSchema = z
  .object({
    productPotential: z.enum(["high", "medium", "low"]),
    opportunityScore: z.number().min(0).max(100),
    confidenceScore: z.number().min(0).max(100),
    audience: z.string().trim().min(1),
    promise: z.string().trim().min(1),
    pain: z.string().trim().min(1),
    bestAngle: z.string().trim().min(1),
    risks: z.string().trim().min(1),
    nextStep: z.string().trim().min(1),
    creativeIdeas: stringList,
    vslIdeas: stringList,
    productIdeas: stringList,
  })
  .strict();

const contentAnalysisSchema = z
  .object({
    hook: z.string().trim().min(1),
    promise: z.string().trim().min(1),
    pain: z.string().trim().min(1),
    audience: z.string().trim().min(1),
    format: z.string().trim().min(1),
    whyItWorked: z.string().trim().min(1),
    adaptAd: z.string().trim().min(1),
    adaptVsl: z.string().trim().min(1),
    adaptUgc: z.string().trim().min(1),
    risks: z.string().trim().min(1),
    tags: z.array(z.string().trim().min(1)).min(3).max(10),
  })
  .strict();

const clampScore = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

function normalizeMarketDiagnosis(
  diagnosis: MarketDiagnosis,
  youtubeSignalsAreReal: boolean,
  trendsSignalsAreReal: boolean,
): MarketDiagnosis {
  const realSignals = [
    ...(youtubeSignalsAreReal ? ["YouTube"] : []),
    ...(trendsSignalsAreReal ? ["Google Trends"] : []),
  ];
  const contextNote =
    realSignals.length > 0
      ? `Analise preliminar com sinais reais de ${realSignals.join(" e ")} e demais sinais simulados.`
      : "Analise preliminar baseada em sinais simulados.";
  const nextStep = diagnosis.nextStep.includes("Analise preliminar")
    ? diagnosis.nextStep
    : `${contextNote} ${diagnosis.nextStep}`;

  return {
    ...diagnosis,
    opportunityScore: clampScore(diagnosis.opportunityScore),
    confidenceScore: clampScore(diagnosis.confidenceScore),
    nextStep,
  };
}

export async function generateMarketDiagnosis(input: {
  topic: string;
  language: string;
  period: string;
  keywordExpansion: KeywordExpansion;
  mockSignals: MockSignals;
  youtubeSignalsAreReal?: boolean;
  youtubeResultCount?: number;
  trendsSignalsAreReal?: boolean;
}): Promise<MarketDiagnosis> {
  const signalRules = [
    input.youtubeSignalsAreReal
      ? "YouTube Shorts signals are real data from YouTube Data API."
      : "YouTube Shorts signals are simulated mocks.",
    input.trendsSignalsAreReal
      ? "Google Trends signals are real relative-index data via SerpApi."
      : "Google Trends signals are simulated mocks.",
    "TikTok and Ads signals are simulated mocks.",
  ].join(" ");

  const result = await createStructuredResponse({
    model: deepOpenAIModel,
    schema: marketDiagnosisSchema,
    schemaName: "market_diagnosis",
    instructions:
      "You are a conservative direct-response market analyst. Return only structured JSON that follows the schema.",
    input: JSON.stringify({
      task: "Create a preliminary product and market diagnosis for deciding whether to research or test a topic.",
      rules: [
        "Use the requested output language.",
        signalRules,
        "When signals are simulated, phrase the diagnosis as preliminary analysis based on simulated signals.",
        "You may reference YouTube views, likes, comments, and recency only when YouTube signals are marked real.",
        "You may reference Google Trends direction and relative interest only when Google Trends signals are marked real.",
        "Do not claim real demand, sales, or absolute search volume from Google Trends.",
        "Do not promise guaranteed financial results.",
        "Avoid aggressive, sensitive, or misleading claims.",
        "Keep opportunityScore and confidenceScore between 0 and 100.",
      ],
      input,
    }),
  });

  return normalizeMarketDiagnosis(
    result,
    Boolean(input.youtubeSignalsAreReal),
    Boolean(input.trendsSignalsAreReal),
  );
}

export async function generateContentAnalysis(
  input: ContentAnalysisInput,
): Promise<ContentAnalysis> {
  return createStructuredResponse({
    model: defaultOpenAIModel,
    schema: contentAnalysisSchema,
    schemaName: "content_analysis",
    instructions:
      "You are a direct-response creative analyst. Return only structured JSON that follows the schema.",
    input: JSON.stringify({
      task: "Analyze the structure of one creative and suggest ethical adaptations.",
      rules: [
        "Use the requested language when provided.",
        "Do not say the content went viral unless real metrics prove that.",
        "If metrics are missing or simulated, say the analysis is structural.",
        "Do not copy third-party content literally.",
        "Suggest adaptation of the structure, not copying.",
        "Avoid guaranteed earnings or aggressive claims.",
      ],
      input,
    }),
  });
}
