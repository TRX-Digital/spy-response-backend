import { supabase } from "../supabase.js";
import { HttpError, type SearchDetails, type SearchInput, type SourceResult } from "../types.js";
import { env } from "../env.js";
import { generateKeywordExpansion } from "./ai-keyword-expansion.js";
import { generateMarketDiagnosis } from "./ai-market-analysis.js";
import {
  buildMockAuditLogs,
  buildKeywordExpansionRows,
  buildMarketDiagnosisRow,
  buildMockKeywordExpansionData,
  buildMockMarketDiagnosisData,
  buildMockSearch,
  buildOpenAIFallbackAuditLog,
} from "./mock-search.js";
import { logOpenAIWarning } from "./openai-client.js";
import {
  searchTikTokVideos,
  type TikTokVideoItem,
} from "./apify-tiktok-service.js";
import { searchMetaAds, type MetaAdItem } from "./apify-meta-ads-service.js";
import { searchGoogleTrends } from "./serpapi-trends-service.js";
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
    },
  }));

const buildTikTokSourceRows = (
  searchId: string,
  items: TikTokVideoItem[],
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
      authorName: item.authorName,
      authorNickname: item.authorNickname,
      authorUrl: item.authorUrl,
      publishedAt: item.publishedAt,
      durationSeconds: item.durationSeconds,
      views: item.views,
      likes: item.likes,
      comments: item.comments,
      shares: item.shares,
      collects: item.collects,
      hashtags: item.hashtags,
      raw: item.payload,
    },
  }));

const buildMetaAdRows = (searchId: string, items: MetaAdItem[]) =>
  items.map((item) => ({
    search_id: searchId,
    advertiser: item.advertiser,
    text: item.text,
    library_link: item.libraryLink,
    active: item.active,
    start_date: item.startDate,
    platforms: item.platforms,
    promise: item.promise,
    cta: item.cta,
    angle: item.angle,
    score: item.score,
    payload: {
      source: item.source,
      creativeUrl: item.creativeUrl,
      raw: item.payload,
    },
  }));

const buildTrendResultRow = (
  searchId: string,
  trend: {
    status: string;
    series: unknown[];
    related: unknown[];
    rising: unknown[];
    variations: unknown[];
    reading: string;
  },
) => ({
  search_id: searchId,
  status: trend.status,
  series: trend.series,
  related: trend.related,
  rising: trend.rising,
  variations: trend.variations,
  reading: trend.reading,
});

const weightedScoreWithTrends = (aiScore: number, interestScore: number) =>
  Math.round(aiScore * 0.75 + interestScore * 0.25);

const asRecord = (value: unknown): Record<string, unknown> => {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return {};
};

const toNumberOrNull = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);

    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
};

const normalizeYouTubeSourceResult = (row: SourceResult) => {
  const payload = asRecord(row.payload);

  return {
    id: row.id,
    source: "youtube_shorts",
    rank: row.rank,
    title: row.title,
    link: row.link,
    thumbnail: row.thumbnail,
    score: row.score,
    payload: {
      videoId: payload.videoId ?? null,
      description: payload.description ?? "",
      channelTitle: payload.channelTitle ?? "",
      channelId: payload.channelId ?? "",
      publishedAt: payload.publishedAt ?? "",
      durationSeconds: toNumberOrNull(payload.durationSeconds),
      views: toNumberOrNull(payload.views) ?? 0,
      likes: toNumberOrNull(payload.likes),
      comments: toNumberOrNull(payload.comments),
      hashtags: Array.isArray(payload.hashtags) ? payload.hashtags : [],
    },
  };
};

const normalizeTikTokSourceResult = (row: SourceResult) => {
  const payload = asRecord(row.payload);

  return {
    id: row.id,
    source: "tiktok",
    rank: row.rank,
    title: row.title,
    link: row.link,
    thumbnail: row.thumbnail,
    score: row.score,
    payload: {
      videoId: payload.videoId ?? null,
      description: payload.description ?? "",
      authorName: payload.authorName ?? payload.author ?? "",
      authorNickname: payload.authorNickname ?? "",
      authorUrl: payload.authorUrl ?? "",
      publishedAt: payload.publishedAt ?? "",
      durationSeconds:
        toNumberOrNull(payload.durationSeconds) ??
        toNumberOrNull(payload.duration_seconds),
      views: toNumberOrNull(payload.views) ?? 0,
      likes: toNumberOrNull(payload.likes) ?? 0,
      comments: toNumberOrNull(payload.comments) ?? 0,
      shares: toNumberOrNull(payload.shares) ?? 0,
      collects: toNumberOrNull(payload.collects) ?? 0,
      hashtags: Array.isArray(payload.hashtags) ? payload.hashtags : [],
    },
  };
};

const normalizeSourceResult = (row: SourceResult) => {
  if (row.source === "youtube_shorts") {
    return normalizeYouTubeSourceResult(row);
  }

  if (row.source === "tiktok") {
    return normalizeTikTokSourceResult(row);
  }

  return row;
};

const normalizeAdResult = (row: Record<string, unknown>) => ({
  id: row.id,
  advertiser: row.advertiser ?? "",
  text: row.text ?? "",
  library_link: row.library_link ?? "",
  active: row.active ?? false,
  start_date: row.start_date ?? "",
  platforms: Array.isArray(row.platforms) ? row.platforms : [],
  promise: row.promise ?? "",
  cta: row.cta ?? "",
  angle: row.angle ?? "",
  score: row.score ?? 0,
  payload: row.payload ?? {},
});

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

    const trendsResult = await searchGoogleTrends({
      topic: input.topic,
      language: input.language,
      period: input.period,
      expandedTerms: keywordExpansion.expandedTerms,
    });
    const trendResults = buildTrendResultRow(searchId, trendsResult.trend);
    const tiktokResult = await searchTikTokVideos({
      topic: input.topic,
      language: input.language,
      period: input.period,
      expandedTerms: keywordExpansion.expandedTerms,
      hashtags: keywordExpansion.hashtags,
      maxResults: env.TIKTOK_MAX_RESULTS,
    });
    const tiktokSourceResults = buildTikTokSourceRows(
      searchId,
      tiktokResult.items,
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
    const metaAdsResult = await searchMetaAds({
      topic: input.topic,
      language: input.language,
      period: input.period,
      expandedTerms: keywordExpansion.expandedTerms,
    });
    const adResults = buildMetaAdRows(searchId, metaAdsResult.items);
    const tiktokSignals = tiktokResult.items;
    const youtubeSignals = youtubeResult.items;
    const adsSignals = metaAdsResult.items;

    const marketDiagnosis = await generateMarketDiagnosis({
      ...input,
      keywordExpansion,
      mockSignals: {
        trends: trendResults,
        tiktok: tiktokSignals,
        youtube: youtubeSignals,
        ads: adsSignals,
      },
      youtubeSignalsAreReal: !youtubeResult.usedFallback,
      youtubeResultCount: youtubeResult.items.length,
      trendsSignalsAreReal: !trendsResult.usedFallback,
      tiktokSignalsAreReal: !tiktokResult.usedFallback,
      adsSignalsAreReal: !metaAdsResult.usedFallback,
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
    console.info("[youtube] source_results inserted", {
      insertedVideos: youtubeSourceResults.length,
    });
    console.info("[tiktok] source_results inserted", {
      insertedVideos: tiktokSourceResults.length,
    });
    await insertRows("ad_results", adResults);
    console.info("[meta_ads] ad_results inserted", {
      insertedAds: adResults.length,
    });
    await insertRows("market_diagnosis", [
      buildMarketDiagnosisRow(searchId, marketDiagnosis),
    ]);
    await updateSearchScores(
      searchId,
      userId,
      trendsResult.usedFallback
        ? marketDiagnosis.opportunityScore
        : weightedScoreWithTrends(
            marketDiagnosis.opportunityScore,
            trendsResult.trend.interestScore,
          ),
      marketDiagnosis.confidenceScore,
    );

    const auditLogs = buildMockAuditLogs(searchId).filter(
      (log) =>
        log.source !== "youtube_shorts" &&
        log.source !== "tiktok" &&
        log.source !== "meta_ads",
    );

    if (metaAdsResult.usedFallback) {
      auditLogs.push({
        search_id: searchId,
        severity: "warning",
        source: "meta_ads",
        message: "Apify Meta Ads Library Scraper unavailable, mock fallback used.",
      });
    } else {
      auditLogs.push({
        search_id: searchId,
        severity: "info",
        source: "meta_ads",
        message: "Meta Ads Library collection completed.",
      });

      if (metaAdsResult.items.length === 0) {
        auditLogs.push({
          search_id: searchId,
          severity: "info",
          source: "meta_ads",
          message: "Meta Ads Library returned no ads for this search.",
        });
      } else if (metaAdsResult.items.length < 10) {
        auditLogs.push({
          search_id: searchId,
          severity: "info",
          source: "meta_ads",
          message: "Meta Ads Library returned fewer than 10 relevant ads.",
        });
      }
    }

    if (tiktokResult.usedFallback) {
      auditLogs.push({
        search_id: searchId,
        severity: "warning",
        source: "tiktok",
        message: "Apify TikTok Scraper unavailable, mock fallback used.",
      });
    } else {
      auditLogs.push({
        search_id: searchId,
        severity: "info",
        source: "tiktok",
        message: "Apify TikTok Scraper collection completed.",
      });

      if (tiktokResult.items.length < 10) {
        auditLogs.push({
          search_id: searchId,
          severity: "info",
          source: "tiktok",
          message: "TikTok returned fewer than 10 relevant videos.",
        });
      }

      if (tiktokResult.periodFilterRelaxed) {
        auditLogs.push({
          search_id: searchId,
          severity: "info",
          source: "tiktok",
          message: "TikTok period filter returned few results; expanded date range.",
        });
      }
    }

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

      if (youtubeResult.items.length === 0) {
        auditLogs.push({
          search_id: searchId,
          severity: "info",
          source: "youtube_shorts",
          message: "YouTube returned no relevant short videos for this search.",
        });
      } else if (youtubeResult.items.length < env.YOUTUBE_MAX_RESULTS) {
        auditLogs.push({
          search_id: searchId,
          severity: "info",
          source: "youtube_shorts",
          message: "YouTube returned fewer than 10 relevant short videos.",
        });
      }
    }

    if (trendsResult.usedFallback) {
      auditLogs.push({
        search_id: searchId,
        severity: "warning",
        source: "google_trends",
        message: "SerpApi Google Trends unavailable, mock fallback used.",
      });
    } else if (trendsResult.trend.status === "insufficient_data") {
      auditLogs.push({
        search_id: searchId,
        severity: "info",
        source: "google_trends",
        message: "Google Trends returned insufficient data for this search.",
      });
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
    youtube_shorts: [],
    tiktok: [],
    internal: [],
  };

  for (const row of rows) {
    const source = row.source ?? "internal";

    if (!grouped[source]) {
      grouped[source] = [];
    }

    grouped[source]?.push(normalizeSourceResult(row as SourceResult));
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
    adResults: (adResults as Record<string, unknown>[]).map(normalizeAdResult),
    marketDiagnosis,
    auditLogs,
  };
}
