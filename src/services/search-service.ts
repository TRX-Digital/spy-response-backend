import { supabase } from "../supabase.js";
import { HttpError, type SearchDetails, type SearchInput, type SourceResult } from "../types.js";
import { env } from "../env.js";
import { generateKeywordExpansion } from "./ai-keyword-expansion.js";
import { generateMarketDiagnosis } from "./ai-market-analysis.js";
import {
  buildMockAdResults,
  buildMockAuditLogs,
  buildKeywordExpansionRows,
  buildMarketDiagnosisRow,
  buildMockKeywordExpansionData,
  buildMockMarketDiagnosisData,
  buildMockSearch,
  buildMockSourceResults,
  buildMockTrendResults,
  buildOpenAIFallbackAuditLog,
} from "./mock-search.js";
import { logOpenAIWarning } from "./openai-client.js";
import {
  searchYouTubeShorts,
  type YouTubeShortItem,
} from "./youtube-service.js";

const ensureSupabase = () => {
  if (!supabase) {
    throw new HttpError(500, "Supabase is not configured");
  }

  return supabase;
};

const logDatabaseError = (context: string, error: unknown) => {
  console.error(`[database] ${context}`, error);
};

const relatedTables = [
  "keyword_expansions",
  "trend_results",
  "source_results",
  "ad_results",
  "market_diagnosis",
  "data_audit_logs",
];

const insertRows = async (table: string, rows: Record<string, unknown>[]) => {
  if (rows.length === 0) {
    return;
  }

  const client = ensureSupabase();
  const { error } = await client.from(table).insert(rows);

  if (error) {
    logDatabaseError(`insert ${table}`, error);
    throw new HttpError(500, "Unable to create search mock data");
  }
};

const updateSearchScores = async (
  searchId: string,
  userId: string,
  score: number,
  confidence: number,
) => {
  const client = ensureSupabase();
  const { error } = await client
    .from("searches")
    .update({ score, confidence })
    .eq("id", searchId)
    .eq("user_id", userId);

  if (error) {
    logDatabaseError("update searches scores", error);
    throw new HttpError(500, "Unable to update search scores");
  }
};

const buildYouTubeSourceRows = (
  searchId: string,
  items: YouTubeShortItem[],
) =>
  items.map((item) => ({
    search_id: searchId,
    source: item.source,
    rank: item.rank,
    title: item.title,
    link: item.link,
    thumbnail: item.thumbnail,
    score: item.score,
    payload: {
      videoId: item.videoId,
      description: item.description,
      channelTitle: item.channelTitle,
      channelId: item.channelId,
      publishedAt: item.publishedAt,
      durationSeconds: item.durationSeconds,
      views: item.views,
      likes: item.likes,
      comments: item.comments,
      hashtags: item.hashtags,
      raw: item.payload,
    },
  }));

const rollbackSearch = async (searchId: string, userId: string) => {
  const client = ensureSupabase();

  for (const table of relatedTables) {
    const { error } = await client.from(table).delete().eq("search_id", searchId);

    if (error) {
      logDatabaseError(`rollback ${table}`, error);
    }
  }

  const { error } = await client
    .from("searches")
    .delete()
    .eq("id", searchId)
    .eq("user_id", userId);

  if (error) {
    logDatabaseError("rollback searches", error);
  }
};

export async function createSearchWithMocks(input: SearchInput, userId: string) {
  const client = ensureSupabase();

  const { data: search, error } = await client
    .from("searches")
    .insert(buildMockSearch(input, userId))
    .select("id")
    .single();

  if (error || !search?.id) {
    logDatabaseError("insert searches", error);
    throw new HttpError(500, "Unable to create search");
  }

  const searchId = String(search.id);

  try {
    let openAIFallbackUsed = false;

    const keywordExpansion = await generateKeywordExpansion(input).catch((error) => {
      openAIFallbackUsed = true;
      logOpenAIWarning("keyword expansion fallback", error);

      return buildMockKeywordExpansionData(input.topic);
    });

    const trendResults = buildMockTrendResults(searchId, input.topic);
    const mockSourceResults = buildMockSourceResults(searchId, input.topic);
    const tiktokSourceResults = mockSourceResults.filter(
      (result) => result.source === "tiktok",
    );
    const youtubeResult = await searchYouTubeShorts({
      topic: input.topic,
      language: input.language,
      period: input.period,
      expandedTerms: keywordExpansion.expandedTerms,
      hashtags: keywordExpansion.hashtags,
      maxResults: env.YOUTUBE_MAX_RESULTS,
    });
    const youtubeSourceResults = buildYouTubeSourceRows(
      searchId,
      youtubeResult.items,
    );
    const sourceResults = [...tiktokSourceResults, ...youtubeSourceResults];
    const adResults = buildMockAdResults(searchId, input.topic);
    const tiktokSignals = tiktokSourceResults;
    const youtubeSignals = youtubeResult.items;

    const marketDiagnosis = await generateMarketDiagnosis({
      ...input,
      keywordExpansion,
      mockSignals: {
        trends: trendResults,
        tiktok: tiktokSignals,
        youtube: youtubeSignals,
        ads: adResults,
      },
      youtubeSignalsAreReal: !youtubeResult.usedFallback,
      youtubeResultCount: youtubeResult.items.length,
    }).catch((error) => {
      openAIFallbackUsed = true;
      logOpenAIWarning("market diagnosis fallback", error);

      return buildMockMarketDiagnosisData(input.topic);
    });

    await insertRows(
      "keyword_expansions",
      buildKeywordExpansionRows(searchId, keywordExpansion),
    );
    await insertRows("trend_results", [trendResults]);
    await insertRows("source_results", sourceResults);
    await insertRows("ad_results", adResults);
    await insertRows("market_diagnosis", [
      buildMarketDiagnosisRow(searchId, marketDiagnosis),
    ]);
    await updateSearchScores(
      searchId,
      userId,
      marketDiagnosis.opportunityScore,
      marketDiagnosis.confidenceScore,
    );

    const auditLogs = buildMockAuditLogs(searchId).filter(
      (log) => log.source !== "youtube_shorts",
    );

    if (youtubeResult.usedFallback) {
      auditLogs.push({
        search_id: searchId,
        severity: "warning",
        source: "youtube_shorts",
        message: "YouTube Data API unavailable, mock fallback used.",
      });
    } else {
      auditLogs.push({
        search_id: searchId,
        severity: "info",
        source: "youtube_shorts",
        message: "YouTube Data API collection completed.",
      });

      if (youtubeResult.items.length < env.YOUTUBE_MAX_RESULTS) {
        auditLogs.push({
          search_id: searchId,
          severity: "info",
          source: "youtube_shorts",
          message: "YouTube returned fewer than 10 relevant short videos.",
        });
      }
    }

    await insertRows("data_audit_logs", [
      ...auditLogs,
      ...(openAIFallbackUsed ? [buildOpenAIFallbackAuditLog(searchId)] : []),
    ]);
  } catch (error) {
    await rollbackSearch(searchId, userId);
    throw error;
  }

  return searchId;
}

async function fetchMany(table: string, searchId: string) {
  const client = ensureSupabase();
  const { data, error } = await client.from(table).select("*").eq("search_id", searchId);

  if (error) {
    logDatabaseError(`select ${table}`, error);
    throw new HttpError(500, "Unable to load search data");
  }

  return data ?? [];
}

async function fetchOne(table: string, searchId: string) {
  const client = ensureSupabase();
  const { data, error } = await client
    .from(table)
    .select("*")
    .eq("search_id", searchId)
    .maybeSingle();

  if (error) {
    logDatabaseError(`select ${table}`, error);
    throw new HttpError(500, "Unable to load search data");
  }

  return data;
}

function groupBySource<T extends { source?: string | null }>(rows: T[]) {
  const grouped: Record<string, SourceResult[]> = {
    tiktok: [],
    youtube_shorts: [],
  };

  for (const row of rows) {
    const source = row.source ?? "unknown";

    if (!grouped[source]) {
      grouped[source] = [];
    }

    grouped[source]?.push(row as SourceResult);
  }

  return grouped;
}

export async function getSearchDetails(
  searchId: string,
  userId: string,
): Promise<SearchDetails> {
  const client = ensureSupabase();

  const { data: search, error } = await client
    .from("searches")
    .select("*")
    .eq("id", searchId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    logDatabaseError("select searches", error);
    throw new HttpError(500, "Unable to load search");
  }

  if (!search) {
    throw new HttpError(404, "Search not found");
  }

  const [
    keywordExpansions,
    trendResults,
    sourceResults,
    adResults,
    marketDiagnosis,
    auditLogs,
  ] = await Promise.all([
    fetchMany("keyword_expansions", searchId),
    fetchOne("trend_results", searchId),
    fetchMany("source_results", searchId),
    fetchMany("ad_results", searchId),
    fetchOne("market_diagnosis", searchId),
    fetchMany("data_audit_logs", searchId),
  ]);

  return {
    search,
    keywordExpansions,
    trendResults,
    sourceResults: groupBySource(sourceResults as SourceResult[]),
    adResults,
    marketDiagnosis,
    auditLogs,
  };
}
