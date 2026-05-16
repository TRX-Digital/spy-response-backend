import { env, isSerpApiConfigured } from "../env.js";

type SerpApiGoogleTrendsStatus = "connected" | "error" | "pending";

type TrendStatus =
  | "rising"
  | "stable"
  | "declining"
  | "low_volume"
  | "insufficient_data";

export type GoogleTrendsResult = {
  trend: {
    status: TrendStatus;
    series: Array<Record<string, unknown>>;
    related: Array<Record<string, unknown>>;
    rising: Array<Record<string, unknown>>;
    variations: Array<Record<string, unknown>>;
    reading: string;
    interestScore: number;
    raw?: unknown;
  };
  usedFallback: boolean;
  error?: string;
};

let serpApiGoogleTrendsStatus: SerpApiGoogleTrendsStatus = "pending";

export function getSerpApiGoogleTrendsStatus(): SerpApiGoogleTrendsStatus {
  if (!isSerpApiConfigured) {
    return "pending";
  }

  return serpApiGoogleTrendsStatus;
}

function setSerpApiGoogleTrendsStatus(status: SerpApiGoogleTrendsStatus) {
  serpApiGoogleTrendsStatus = status;
}

function logSerpApiWarning(context: string, error: unknown) {
  const safeError =
    error instanceof Error
      ? { name: error.name, message: error.message }
      : { message: "Unknown SerpApi Google Trends error" };

  console.warn(`[serpapi] ${context}`, safeError);
}

function languageToHl(language: string) {
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
    normalized.includes("portugues") ||
    normalized.includes("portuguese") ||
    normalized.startsWith("pt")
  ) {
    return "pt";
  }

  if (
    normalized.includes("ingles") ||
    normalized.includes("english") ||
    normalized.startsWith("en")
  ) {
    return "en";
  }

  return "en";
}

function periodToDate(period: string) {
  switch (period) {
    case "7":
      return "now 7-d";
    case "15":
    case "30":
      return "today 1-m";
    case "90":
      return "today 3-m";
    case "all_time":
      return "today 5-y";
    default:
      return "today 1-m";
  }
}

function buildVariationQueries(topic: string, expandedTerms: string[]) {
  const queries = [topic, ...expandedTerms.slice(0, Math.max(0, env.SERPAPI_MAX_QUERIES - 1))];
  const seen = new Set<string>();

  return queries
    .map((query) => query.trim())
    .filter(Boolean)
    .filter((query) => {
      const key = query.toLowerCase();

      if (seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    })
    .slice(0, env.SERPAPI_MAX_QUERIES);
}

async function fetchSerpApiJson(params: Record<string, string>) {
  if (!env.SERPAPI_KEY) {
    throw new Error("SerpApi key is not configured");
  }

  const url = new URL("https://serpapi.com/search");

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  url.searchParams.set("api_key", env.SERPAPI_KEY);

  console.info("[serpapi] request", {
    query: params.q,
    dataType: params.data_type,
  });

  const response = await fetch(url);

  console.info("[serpapi] response", {
    query: params.q,
    dataType: params.data_type,
    status: response.status,
  });

  if (!response.ok) {
    throw new Error(`SerpApi Google Trends request failed with status ${response.status}`);
  }

  const json = (await response.json()) as Record<string, unknown>;

  if (typeof json.error === "string" && json.error.trim()) {
    throw new Error(`SerpApi Google Trends error: ${json.error}`);
  }

  return json;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function toNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value.replace(/[^\d.-]/g, ""));

    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function extractValueFromTimelineItem(item: Record<string, unknown>, topic: string) {
  const extractedValue = toNumber(item.extracted_value);

  if (extractedValue !== null) {
    return extractedValue;
  }

  const value = toNumber(item.value);

  if (value !== null) {
    return value;
  }

  const values = asArray(item.values).map(asRecord);
  const topicValue =
    values.find((entry) => String(entry.query ?? "").toLowerCase() === topic.toLowerCase()) ??
    values[0];

  if (!topicValue) {
    return 0;
  }

  return (
    toNumber(topicValue.extracted_value) ??
    toNumber(topicValue.value) ??
    0
  );
}

function normalizeTimelineData(response: Record<string, unknown>, topic: string) {
  const interestOverTime = asRecord(response.interest_over_time);
  const timelineData =
    asArray(interestOverTime.timeline_data).length > 0
      ? asArray(interestOverTime.timeline_data)
      : asArray(response.timeline_data);

  return timelineData.map((item) => {
    const entry = asRecord(item);

    return {
      date: String(entry.date ?? entry.formatted_time ?? entry.time ?? ""),
      value: extractValueFromTimelineItem(entry, topic),
    };
  });
}

function normalizeRelatedEntry(entry: Record<string, unknown>) {
  const topic = asRecord(entry.topic);
  const title =
    entry.query ??
    entry.title ??
    topic.title ??
    entry.name ??
    "";

  return {
    title,
    value: entry.value ?? null,
    extractedValue: toNumber(entry.extracted_value),
    type: entry.type ?? topic.type ?? null,
  };
}

function normalizeRelatedQueries(response: Record<string, unknown>) {
  const relatedQueries = asRecord(response.related_queries);
  const top = asArray(relatedQueries.top).map(asRecord);
  const rising = asArray(relatedQueries.rising).map(asRecord);

  return {
    related: top.map(normalizeRelatedEntry),
    rising: rising.map(normalizeRelatedEntry),
  };
}

function normalizeRelatedTopics(response: Record<string, unknown>) {
  const relatedTopics = asRecord(response.related_topics);
  const top = asArray(relatedTopics.top).map(asRecord);
  const rising = asArray(relatedTopics.rising).map(asRecord);

  return {
    related: top.map(normalizeRelatedEntry),
    rising: rising.map(normalizeRelatedEntry),
  };
}

function average(values: number[]) {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function edgeAverage(values: number[], edge: "first" | "last") {
  const count = Math.max(1, Math.ceil(values.length * 0.25));
  const segment = edge === "first" ? values.slice(0, count) : values.slice(-count);

  return average(segment);
}

function calculateTrendMetrics(series: Array<{ value: number }>) {
  const values = series.map((item) => item.value).filter((value) => Number.isFinite(value));

  if (values.length === 0) {
    return {
      interestScore: 0,
      status: "insufficient_data" as TrendStatus,
    };
  }

  const mean = average(values);
  const first = edgeAverage(values, "first");
  const last = edgeAverage(values, "last");
  const delta = last - first;
  const allZero = values.every((value) => value === 0);

  if (allZero) {
    return {
      interestScore: 10,
      status: "low_volume" as TrendStatus,
    };
  }

  let score = mean;

  if (delta > 15) {
    score += 15;
  } else if (delta > 5) {
    score += 8;
  } else if (delta < -15) {
    score -= 15;
  } else if (delta < -5) {
    score -= 8;
  }

  score = Math.max(0, Math.min(100, Math.round(score)));

  if (mean < 20) {
    return {
      interestScore: Math.min(score, 45),
      status: "low_volume" as TrendStatus,
    };
  }

  if (delta > 10) {
    return {
      interestScore: score,
      status: "rising" as TrendStatus,
    };
  }

  if (delta < -10) {
    return {
      interestScore: score,
      status: "declining" as TrendStatus,
    };
  }

  return {
    interestScore: score,
    status: "stable" as TrendStatus,
  };
}

function buildReading(status: TrendStatus, language: string) {
  const hl = languageToHl(language);

  if (hl === "es") {
    return `Datos de Google Trends via SerpApi: la tendencia aparece como ${status}. Google Trends usa un indice relativo, no volumen absoluto.`;
  }

  if (hl === "pt") {
    return `Dados do Google Trends via SerpApi: a tendencia aparece como ${status}. O Google Trends usa indice relativo, nao volume absoluto.`;
  }

  return `Google Trends data via SerpApi: the trend appears ${status}. Google Trends uses a relative index, not absolute volume.`;
}

function fallbackTrend(topic: string, language: string): GoogleTrendsResult["trend"] {
  return {
    status: "insufficient_data",
    series: [
      { date: "Semana 1", value: 35 },
      { date: "Semana 2", value: 42 },
      { date: "Semana 3", value: 48 },
      { date: "Semana 4", value: 51 },
    ],
    related: [
      { title: `${topic} facil`, value: null },
      { title: `${topic} para vender`, value: null },
    ],
    rising: [
      { title: `${topic} rapido`, value: null },
      { title: `${topic} passo a passo`, value: null },
    ],
    variations: [{ query: topic }],
    reading: buildReading("insufficient_data", language),
    interestScore: 45,
  };
}

function fallbackResult(topic: string, language: string, error: string): GoogleTrendsResult {
  return {
    trend: fallbackTrend(topic, language),
    usedFallback: true,
    error,
  };
}

export async function searchGoogleTrends(input: {
  topic: string;
  language: string;
  period: string;
  expandedTerms: string[];
}): Promise<GoogleTrendsResult> {
  if (!env.SERPAPI_KEY) {
    setSerpApiGoogleTrendsStatus("pending");

    return fallbackResult(input.topic, input.language, "SerpApi key is not configured");
  }

  try {
    const hl = languageToHl(input.language);
    const date = periodToDate(input.period);
    const queries = buildVariationQueries(input.topic, input.expandedTerms);
    const timeseriesQuery = queries.join(",");
    const baseParams = {
      engine: "google_trends",
      hl,
      date,
    };

    const [timeseriesResponse, relatedQueriesResponse, relatedTopicsResponse] =
      await Promise.all([
        fetchSerpApiJson({
          ...baseParams,
          q: timeseriesQuery,
          data_type: "TIMESERIES",
        }),
        fetchSerpApiJson({
          ...baseParams,
          q: input.topic,
          data_type: "RELATED_QUERIES",
        }),
        fetchSerpApiJson({
          ...baseParams,
          q: input.topic,
          data_type: "RELATED_TOPICS",
        }),
      ]);

    const series = normalizeTimelineData(timeseriesResponse, input.topic);
    const metrics = calculateTrendMetrics(series);
    const relatedQueries = normalizeRelatedQueries(relatedQueriesResponse);
    const relatedTopics = normalizeRelatedTopics(relatedTopicsResponse);
    const related = [...relatedQueries.related, ...relatedTopics.related].slice(0, 20);
    const rising = [...relatedQueries.rising, ...relatedTopics.rising].slice(0, 20);
    const variations = queries.map((query) => ({ query }));

    setSerpApiGoogleTrendsStatus("connected");

    console.info("[serpapi] normalized trends", {
      query: input.topic,
      seriesPoints: series.length,
      relatedCount: related.length,
      risingCount: rising.length,
      status: metrics.status,
    });

    return {
      trend: {
        status: metrics.status,
        series,
        related,
        rising,
        variations,
        reading: buildReading(metrics.status, input.language),
        interestScore: metrics.interestScore,
        raw: {
          timeseries: timeseriesResponse,
          relatedQueries: relatedQueriesResponse,
          relatedTopics: relatedTopicsResponse,
        },
      },
      usedFallback: false,
    };
  } catch (error) {
    setSerpApiGoogleTrendsStatus("error");
    logSerpApiWarning("google trends fallback", error);

    const message =
      error instanceof Error ? error.message : "SerpApi Google Trends unavailable";

    return fallbackResult(input.topic, input.language, message);
  }
}
