import { ApifyClient } from "apify-client";
import { env, isApifyTikTokConfigured } from "../env.js";

type TikTokApiStatus = "connected" | "error" | "pending";

type ApifyDatasetItem = Record<string, unknown>;

export type TikTokVideoItem = {
  source: "tiktok";
  rank: number;
  title: string;
  description: string;
  authorName: string;
  authorNickname: string;
  authorUrl: string;
  videoId: string;
  link: string;
  thumbnail: string;
  publishedAt: string;
  durationSeconds: number | null;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  collects: number;
  score: number;
  hashtags: string[];
  payload: unknown;
};

export type TikTokVideosResult = {
  items: TikTokVideoItem[];
  usedFallback: boolean;
  error?: string;
  periodFilterRelaxed?: boolean;
  returnedItems?: number;
  filteredItems?: number;
};

let tiktokApiStatus: TikTokApiStatus = "pending";
let apifyClient: ApifyClient | null = null;

export function getTikTokApiStatus(): TikTokApiStatus {
  if (!isApifyTikTokConfigured) {
    return "pending";
  }

  return tiktokApiStatus;
}

function setTikTokApiStatus(status: TikTokApiStatus) {
  tiktokApiStatus = status;
}

function getApifyClient() {
  if (!env.APIFY_TOKEN) {
    throw new Error("Apify token is not configured");
  }

  if (!apifyClient) {
    apifyClient = new ApifyClient({
      token: env.APIFY_TOKEN,
    });
  }

  return apifyClient;
}

function logTikTokWarning(context: string, error: unknown) {
  const safeError =
    error instanceof Error
      ? { name: error.name, message: error.message }
      : { message: "Unknown Apify TikTok error" };

  console.warn(`[tiktok] ${context}`, safeError);
}

function buildQueries(input: {
  topic: string;
  expandedTerms: string[];
  hashtags: string[];
}) {
  const queries = [
    input.topic,
    ...input.expandedTerms.slice(0, 3),
    ...input.hashtags.slice(0, 3).map((hashtag) => hashtag.replace(/^#+/, "")),
  ];
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
    .slice(0, 3);
}

function languageToCode(language: string) {
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

  return undefined;
}

function cutoffFromPeriod(period: string) {
  if (period === "all_time") {
    return null;
  }

  const days = Number(period);

  if (!Number.isFinite(days) || days <= 0) {
    return null;
  }

  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - days);

  return cutoff.getTime();
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return {};
}

function asString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function toNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value.replace(/[^\d.-]/g, ""));

    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function toNumberOrNull(value: unknown) {
  const parsed = toNumber(value);

  return parsed > 0 ? parsed : null;
}

function normalizeHashtag(value: unknown) {
  if (typeof value === "string") {
    const cleaned = value.trim().replace(/^#+/, "");

    return cleaned ? `#${cleaned}` : "";
  }

  const record = asRecord(value);
  const name = asString(record.name || record.title || record.hashtagName);
  const cleaned = name.trim().replace(/^#+/, "");

  return cleaned ? `#${cleaned}` : "";
}

function extractHashtags(text: string, hashtags: unknown) {
  const fromArray = Array.isArray(hashtags)
    ? hashtags.map(normalizeHashtag).filter(Boolean)
    : [];
  const fromText = text.match(/#[\p{L}\p{N}_]+/gu) ?? [];
  const seen = new Set<string>();

  return [...fromArray, ...fromText].filter((hashtag) => {
    const key = hashtag.toLowerCase();

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function pickThumbnail(videoMeta: Record<string, unknown>, item: ApifyDatasetItem) {
  return (
    asString(videoMeta.coverUrl) ||
    asString(videoMeta.originalCoverUrl) ||
    asString(videoMeta.dynamicCoverUrl) ||
    asString(item.coversOrigin) ||
    asString(item.coverUrl) ||
    ""
  );
}

function normalizeItem(item: ApifyDatasetItem): TikTokVideoItem {
  const authorMeta = asRecord(item.authorMeta);
  const videoMeta = asRecord(item.videoMeta);
  const description = asString(item.text);
  const videoId = asString(item.id || item.videoId);
  const link = asString(item.webVideoUrl || item.url);
  const authorNickname = asString(
    authorMeta.nickName || authorMeta.nickname || authorMeta.name,
  );

  return {
    source: "tiktok",
    rank: 0,
    title: description.slice(0, 90) || "TikTok video",
    description,
    authorName: asString(authorMeta.name),
    authorNickname,
    authorUrl:
      asString(authorMeta.profileUrl) ||
      (authorNickname ? `https://www.tiktok.com/@${authorNickname}` : ""),
    videoId,
    link,
    thumbnail: pickThumbnail(videoMeta, item),
    publishedAt: asString(item.createTimeISO),
    durationSeconds: toNumberOrNull(videoMeta.duration),
    views: toNumber(item.playCount),
    likes: toNumber(item.diggCount),
    comments: toNumber(item.commentCount),
    shares: toNumber(item.shareCount),
    collects: toNumber(item.collectCount),
    score: 0,
    hashtags: extractHashtags(description, item.hashtags),
    payload: item,
  };
}

function dedupeItems(items: ApifyDatasetItem[]) {
  const seen = new Set<string>();

  return items.filter((item) => {
    const id = asString(item.id || item.videoId);
    const url = asString(item.webVideoUrl || item.url);
    const key = id || url;

    if (!key) {
      return false;
    }

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function filterByPeriod(items: ApifyDatasetItem[], period: string) {
  const cutoff = cutoffFromPeriod(period);

  if (!cutoff) {
    return {
      items,
      relaxed: false,
    };
  }

  const filtered = items.filter((item) => {
    const createdAt = Date.parse(asString(item.createTimeISO));

    return Number.isFinite(createdAt) && createdAt >= cutoff;
  });

  if (filtered.length >= 10 || filtered.length >= items.length) {
    return {
      items: filtered,
      relaxed: false,
    };
  }

  return {
    items,
    relaxed: true,
  };
}

function relative(value: number, max: number) {
  if (max <= 0) {
    return 0;
  }

  return value / max;
}

function scoreItems(items: TikTokVideoItem[], expectedLanguage?: string) {
  const maxViews = Math.max(...items.map((item) => item.views), 0);
  const maxLikes = Math.max(...items.map((item) => item.likes), 0);
  const maxComments = Math.max(...items.map((item) => item.comments), 0);
  const maxShares = Math.max(...items.map((item) => item.shares), 0);
  const maxCollects = Math.max(...items.map((item) => item.collects), 0);

  return items.map((item) => {
    const raw = asRecord(item.payload);
    const textLanguage = asString(raw.textLanguage).toLowerCase();
    const languageMultiplier =
      expectedLanguage && textLanguage && textLanguage !== expectedLanguage
        ? 0.85
        : 1;
    const score =
      (relative(item.views, maxViews) * 50 +
        relative(item.likes, maxLikes) * 20 +
        relative(item.comments, maxComments) * 15 +
        relative(item.shares, maxShares) * 10 +
        relative(item.collects, maxCollects) * 5) *
      languageMultiplier;

    return {
      ...item,
      score: Math.max(0, Math.min(100, Math.round(score))),
    };
  });
}

function buildFallbackItems(topic: string): TikTokVideoItem[] {
  return [
    {
      source: "tiktok",
      rank: 1,
      title: `Como comecei com ${topic}`,
      description: `Como comecei com ${topic} usando uma estrutura simples de demonstracao.`,
      authorName: "mock_creator",
      authorNickname: "mock_creator",
      authorUrl: "https://www.tiktok.com/@mock_creator",
      videoId: "mock-tiktok-001",
      link: "https://www.tiktok.com/@mock_creator/video/001",
      thumbnail: "https://placehold.co/600x800?text=TikTok+Mock+1",
      publishedAt: new Date().toISOString(),
      durationSeconds: 32,
      views: 184000,
      likes: 21400,
      comments: 920,
      shares: 3400,
      collects: 1200,
      score: 89,
      hashtags: ["#tiktok", "#ugc"],
      payload: {
        mode: "mock",
        reason: "tiktok_unavailable",
      },
    },
    {
      source: "tiktok",
      rank: 2,
      title: `3 ideias de ${topic} que vendem todo dia`,
      description: `3 ideias de ${topic} que vendem todo dia para iniciantes.`,
      authorName: "mock_seller",
      authorNickname: "mock_seller",
      authorUrl: "https://www.tiktok.com/@mock_seller",
      videoId: "mock-tiktok-002",
      link: "https://www.tiktok.com/@mock_seller/video/002",
      thumbnail: "https://placehold.co/600x800?text=TikTok+Mock+2",
      publishedAt: new Date().toISOString(),
      durationSeconds: 41,
      views: 97000,
      likes: 11200,
      comments: 410,
      shares: 1600,
      collects: 820,
      score: 84,
      hashtags: ["#tiktok", "#vendas"],
      payload: {
        mode: "mock",
        reason: "tiktok_unavailable",
      },
    },
  ];
}

function fallbackResult(topic: string, error: string): TikTokVideosResult {
  return {
    items: buildFallbackItems(topic),
    usedFallback: true,
    error,
  };
}

export async function searchTikTokVideos(input: {
  topic: string;
  language: string;
  period: string;
  expandedTerms: string[];
  hashtags: string[];
  maxResults?: number;
}): Promise<TikTokVideosResult> {
  const sampleSize = input.maxResults ?? env.TIKTOK_MAX_RESULTS;

  if (!env.APIFY_TOKEN) {
    setTikTokApiStatus("pending");

    return fallbackResult(input.topic, "Apify token is not configured");
  }

  try {
    const actorId = env.APIFY_TIKTOK_ACTOR || "clockworks/tiktok-scraper";
    const queries = buildQueries(input);
    const client = getApifyClient();
    const actorInput = {
      searchQueries: queries,
      searchSection: "/video",
      resultsPerPage: sampleSize,
      videoSearchSorting: "MOST_RELEVANT",
      shouldDownloadVideos: false,
      shouldDownloadCovers: false,
      shouldDownloadSlideshowImages: false,
      shouldDownloadAvatars: false,
      shouldDownloadMusicCovers: false,
      downloadSubtitlesOptions: "NEVER_DOWNLOAD_SUBTITLES",
      scrapeRelatedVideos: false,
      commentsPerPost: 0,
      proxyCountryCode: "None",
    };

    console.info("[tiktok] Apify actor starting", {
      actor: actorId,
      queryCount: queries.length,
      resultsPerPage: sampleSize,
    });

    const run = await client.actor(actorId).call(actorInput);
    const datasetId = run.defaultDatasetId;

    if (!datasetId) {
      throw new Error("Apify run did not return a default dataset");
    }

    const { items } = await client.dataset(datasetId).listItems();
    const datasetItems = items as ApifyDatasetItem[];
    const returnedItems = datasetItems.length;
    const dedupedItems = dedupeItems(datasetItems);
    const periodFiltered = filterByPeriod(dedupedItems, input.period);
    const expectedLanguage = languageToCode(input.language);
    const normalizedItems = periodFiltered.items.map(normalizeItem);
    const scoredItems = scoreItems(normalizedItems, expectedLanguage)
      .sort((left, right) => right.score - left.score)
      .slice(0, 10)
      .map((item, index) => ({
        ...item,
        rank: index + 1,
      }));

    console.info("[tiktok] Apify actor completed", {
      actor: actorId,
      returnedItems,
      dedupedItems: dedupedItems.length,
      filteredItems: periodFiltered.items.length,
      savedItems: scoredItems.length,
    });

    setTikTokApiStatus("connected");

    return {
      items: scoredItems,
      usedFallback: false,
      periodFilterRelaxed: periodFiltered.relaxed,
      returnedItems,
      filteredItems: periodFiltered.items.length,
    };
  } catch (error) {
    setTikTokApiStatus("error");
    logTikTokWarning("Apify TikTok fallback", error);

    const message =
      error instanceof Error ? error.message : "Apify TikTok Scraper unavailable";

    return fallbackResult(input.topic, message);
  }
}
