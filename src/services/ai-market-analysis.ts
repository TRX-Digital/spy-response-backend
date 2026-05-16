import { z } from "zod";
import type {
  ContentAnalysis,
  ContentAnalysisInput,
  KeywordExpansion,
  MarketDiagnosis,
  MockSignals,
} from "../types.js";
import { SPY_RESPONSE_STRATEGY_PROMPT } from "../prompts/spy-response-strategy.js";
import {
  createStructuredResponse,
  deepOpenAIModel,
  defaultOpenAIModel,
} from "./openai-client.js";

const stringList = z.array(z.string().trim().min(1)).min(3).max(8);

const marketDiagnosisSchema = z
  .object({
    productPotential: z.enum(["high", "medium", "low"]),
    recommendation: z.enum(["advance", "evaluate", "discard"]),
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

function languageFamily(language: string) {
  const normalized = language
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");

  if (
    normalized.includes("espanhol") ||
    normalized.includes("spanish") ||
    normalized.startsWith("es")
  ) {
    return "es";
  }

  if (
    normalized.includes("ingles") ||
    normalized.includes("english") ||
    normalized.startsWith("en")
  ) {
    return "en";
  }

  return "pt";
}

function buildContextNote(language: string, realSignals: string[]) {
  const family = languageFamily(language);

  if (family === "es") {
    return realSignals.length > 0
      ? `Análisis preliminar con señales reales de ${realSignals.join(" y ")} y las demás señales simuladas.`
      : "Análisis preliminar basado en señales simuladas.";
  }

  if (family === "en") {
    return realSignals.length > 0
      ? `Preliminary analysis with real signals from ${realSignals.join(" and ")} and the remaining signals simulated.`
      : "Preliminary analysis based on simulated signals.";
  }

  return realSignals.length > 0
    ? `Analise preliminar com sinais reais de ${realSignals.join(" e ")} e demais sinais simulados.`
    : "Analise preliminar baseada em sinais simulados.";
}

function normalizeMarketDiagnosis(
  diagnosis: MarketDiagnosis,
  language: string,
  youtubeSignalsAreReal: boolean,
  trendsSignalsAreReal: boolean,
  tiktokSignalsAreReal: boolean,
  adsSignalsAreReal: boolean,
): MarketDiagnosis {
  const realSignals = [
    ...(tiktokSignalsAreReal ? ["TikTok"] : []),
    ...(youtubeSignalsAreReal ? ["YouTube"] : []),
    ...(trendsSignalsAreReal ? ["Google Trends"] : []),
    ...(adsSignalsAreReal ? ["Meta Ads"] : []),
  ];
  const contextNote = buildContextNote(language, realSignals);
  const nextStep = diagnosis.nextStep.includes(contextNote)
    ? diagnosis.nextStep
    : `${contextNote} ${diagnosis.nextStep}`;

  return {
    ...diagnosis,
    opportunityScore: clampScore(diagnosis.opportunityScore),
    confidenceScore: clampScore(diagnosis.confidenceScore),
    recommendation: diagnosis.recommendation,
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
  tiktokSignalsAreReal?: boolean;
  adsSignalsAreReal?: boolean;
}): Promise<MarketDiagnosis> {
  const signalRules = [
    input.tiktokSignalsAreReal
      ? "TikTok signals are real public post data from Apify TikTok Scraper."
      : "TikTok signals are simulated mocks.",
    input.youtubeSignalsAreReal
      ? "YouTube Shorts signals are real data from YouTube Data API."
      : "YouTube Shorts signals are simulated mocks.",
    input.trendsSignalsAreReal
      ? "Google Trends signals are real relative-index data via SerpApi."
      : "Google Trends signals are simulated mocks.",
    input.adsSignalsAreReal
      ? "Meta Ads signals are real public ads data from Meta Ads Library via Apify."
      : "Ads signals are simulated mocks.",
  ].join(" ");

  const result = await createStructuredResponse({
    model: deepOpenAIModel,
    schema: marketDiagnosisSchema,
    schemaName: "market_diagnosis",
    instructions: [
      SPY_RESPONSE_STRATEGY_PROMPT,
      "Nesta tarefa, gere um diagnóstico estratégico de mercado/produto e uma recomendação objetiva. Retorne apenas JSON estruturado conforme o schema.",
    ].join("\n\n"),
    input: JSON.stringify({
      task: "Create a preliminary product and market diagnosis for deciding whether to research or test a topic.",
      rules: [
        "Use the requested output language.",
        signalRules,
        "Explicitly consider Google Trends, TikTok, YouTube Shorts, and Meta Ads signals according to the strategic prompt.",
        "Set recommendation to advance, evaluate, or discard using the recommendation rules.",
        "Generate opportunityScore and confidenceScore from the quality, recency, consistency, and real/fallback status of all available sources.",
        "When signals are simulated, phrase the diagnosis as preliminary analysis based on simulated signals.",
        "You may reference TikTok views, likes, comments, shares, saves, and recency only when TikTok signals are marked real.",
        "You may reference YouTube views, likes, comments, and recency only when YouTube signals are marked real.",
        "You may reference Google Trends direction and relative interest only when Google Trends signals are marked real.",
        "You may reference Meta Ads creative copy, advertiser, platform, active status, and start date only when Meta Ads signals are marked real.",
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
    input.language,
    Boolean(input.youtubeSignalsAreReal),
    Boolean(input.trendsSignalsAreReal),
    Boolean(input.tiktokSignalsAreReal),
    Boolean(input.adsSignalsAreReal),
  );
}

export async function generateContentAnalysis(
  input: ContentAnalysisInput,
): Promise<ContentAnalysis> {
  return createStructuredResponse({
    model: defaultOpenAIModel,
    schema: contentAnalysisSchema,
    schemaName: "content_analysis",
    instructions: [
      SPY_RESPONSE_STRATEGY_PROMPT,
      "Nesta tarefa, analise a estrutura do criativo sem copiar texto literal e sugira adaptações para anúncio, VSL e UGC. Retorne apenas JSON estruturado conforme o schema.",
    ].join("\n\n"),
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
