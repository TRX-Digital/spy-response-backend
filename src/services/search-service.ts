import { supabase } from "../supabase.js";
import { HttpError, type SearchDetails, type SearchInput, type SourceResult } from "../types.js";
import {
  buildMockAdResults,
  buildMockAuditLogs,
  buildMockKeywordExpansions,
  buildMockMarketDiagnosis,
  buildMockSearch,
  buildMockSourceResults,
  buildMockTrendResults,
} from "./mock-search.js";

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
    await insertRows(
      "keyword_expansions",
      buildMockKeywordExpansions(searchId, input.topic),
    );
    await insertRows("trend_results", [
      buildMockTrendResults(searchId, input.topic),
    ]);
    await insertRows("source_results", buildMockSourceResults(searchId, input.topic));
    await insertRows("ad_results", buildMockAdResults(searchId, input.topic));
    await insertRows("market_diagnosis", [
      buildMockMarketDiagnosis(searchId, input.topic),
    ]);
    await insertRows("data_audit_logs", buildMockAuditLogs(searchId));
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
