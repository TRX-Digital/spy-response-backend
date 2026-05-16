import { ApifyClient } from "apify-client";
import { env, isApifyMetaAdsConfigured } from "../env.js";

type MetaAdsApiStatus = "connected" | "error" | "pending";

type ApifyDatasetItem = Record<string, unknown>;

export type MetaAdItem = {
  source: "meta_ads";
  rank: number;
  advertiser: string;
  text: string;
  libraryLink: string;
  creativeUrl: string;
  active: boolean;
  startDate: string;
  platforms: string[];
  promise: string;
  cta: string;
  angle: string;
  score: number;
  payload: unknown;
};

export type MetaAdsResult = {
  items: MetaAdItem[];
  usedFallback: boolean;
  error?: string;
  returnedItems?: number;
  filteredItems?: number;
};

const DEFAULT_META_ADS_ACTOR = "curious_coder/facebook-ads-library-scraper";

let metaAdsApiStatus: MetaAdsApiStatus = "pending";
let apifyClient: ApifyClient | null = null;

export function getMetaAdsApiStatus(): MetaAdsApiStatus {
  if (!isApifyMetaAdsConfigured) {
    return "pending";
  }

  return metaAdsApiStatus;
}

function setMetaAdsApiStatus(status: MetaAdsApiStatus) {
  metaAdsApiStatus = status;
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

function logMetaAdsWarning(context: string, error: unknown) {
  const safeError =
    error instanceof Error
      ? { name: error.name, message: error.message }
      : { message: "Unknown Apify Meta Ads error" };

  console.warn(`[meta_ads] ${context}`, safeError);
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return {};
}

function asString(value: unknown) {
  if (typeof value === "string") {
    return value.trim();
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return "";
}

function asBoolean(value: unknown) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();

    if (["active", "true", "1", "yes"].includes(normalized)) {
      return true;
    }

    if (["inactive", "false", "0", "no"].includes(normalized)) {
      return false;
    }
  }

  return false;
}

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

function uniqueStrings(values: string[]) {
  const seen = new Set<string>();

  return values.filter((value) => {
    const trimmed = value.trim();
    const key = trimmed.toLowerCase();

    if (!trimmed || seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function buildQueries(input: { topic: string; expandedTerms: string[] }) {
  return uniqueStrings([input.topic, ...input.expandedTerms.slice(0, 2)]).slice(
    0,
    3,
  );
}

function buildAdLibraryUrl(query: string) {
  const encodedQuery = encodeURIComponent(query);

  return `https://www.facebook.com/ads/library/?active_status=all&ad_type=all&country=ALL&q=${encodedQuery}&search_type=keyword_unordered&media_type=all`;
}

function dateString(value: unknown) {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    const milliseconds = value > 9999999999 ? value : value * 1000;
    const date = new Date(milliseconds);

    return Number.isNaN(date.getTime()) ? "" : date.toISOString();
  }

  return "";
}

function firstString(...values: unknown[]) {
  for (const value of values) {
    if (Array.isArray(value)) {
      const fromArray = value
        .map((item) => {
          if (typeof item === "string") {
            return item;
          }

          const record = asRecord(item);

          return asString(
            record.url ||
              record.uri ||
              record.original_image_url ||
              record.video_sd_url,
          );
        })
        .find(Boolean);

      if (fromArray) {
        return fromArray;
      }
    }

    const text = asString(value);

    if (text) {
      return text;
    }
  }

  return "";
}

function normalizePlatforms(value: unknown): string[] {
  if (Array.isArray(value)) {
    return uniqueStrings(
      value.flatMap((item) => {
        if (typeof item === "string") {
          return [item.toLowerCase()];
        }

        const record = asRecord(item);

        return [
          asString(record.name || record.platform || record.publisherPlatform)
            .toLowerCase(),
        ];
      }),
    );
  }

  if (typeof value === "string") {
    return uniqueStrings(
      value
        .split(/[,\s]+/)
        .map((platform) => platform.trim().toLowerCase()),
    );
  }

  return [];
}

function normalizeAdText(item: ApifyDatasetItem) {
  const page = asRecord(item.page);
  const snapshot = asRecord(item.snapshot);
  const body = asRecord(snapshot.body);
  const cards = Array.isArray(snapshot.cards) ? snapshot.cards : [];
  const cardText = cards
    .map((card) => {
      const record = asRecord(card);

      return firstString(
        record.body,
        record.title,
        record.caption,
        asRecord(record.body).text,
      );
    })
    .find(Boolean);

  return firstString(
    item.adText,
    item.text,
    item.body,
    item.ad_creative_body,
    item.adCreativeBody,
    body.text,
    snapshot.caption,
    snapshot.title,
    item.caption,
    page.name,
    cardText,
  );
}

function normalizeAdvertiser(item: ApifyDatasetItem) {
  const page = asRecord(item.page);
  const snapshot = asRecord(item.snapshot);

  return firstString(
    item.pageName,
    item.advertiser,
    item.page_name,
    page.name,
    snapshot.pageName,
    snapshot.page_name,
  );
}

function normalizeLibraryLink(item: ApifyDatasetItem) {
  const adId = firstString(
    item.adArchiveId,
    item.ad_archive_id,
    item.adId,
    item.ad_id,
    item.id,
  );

  return (
    firstString(
      item.url,
      item.adLibraryUrl,
      item.ad_archive_url,
      item.libraryUrl,
      item.link,
    ) || (adId ? `https://www.facebook.com/ads/library/?id=${adId}` : "")
  );
}

function normalizeCreativeUrl(item: ApifyDatasetItem) {
  const snapshot = asRecord(item.snapshot);
  const firstImage = Array.isArray(snapshot.images)
    ? asRecord(snapshot.images[0])
    : {};
  const firstVideo = Array.isArray(snapshot.videos)
    ? asRecord(snapshot.videos[0])
    : {};

  return firstString(
    item.imageUrl,
    item.videoUrl,
    item.creativeUrl,
    item.adCreativeImageUrl,
    item.adCreativeVideoUrl,
    snapshot.images,
    snapshot.videos,
    firstImage.original_image_url,
    firstVideo.video_sd_url,
  );
}

function normalizeActive(item: ApifyDatasetItem) {
  return (
    asBoolean(item.isActive) ||
    asBoolean(item.active) ||
    asBoolean(item.status) ||
    asBoolean(item.ad_delivery_status) ||
    asBoolean(item.adDeliveryStatus)
  );
}

function normalizeStartDate(item: ApifyDatasetItem) {
  return (
    dateString(item.startDate) ||
    dateString(item.start_date) ||
    dateString(item.ad_delivery_start_time) ||
    dateString(item.adDeliveryStartTime) ||
    dateString(item.startedAt)
  );
}

function normalizeAdPlatforms(item: ApifyDatasetItem) {
  const snapshot = asRecord(item.snapshot);
  const platforms = [
    ...normalizePlatforms(item.platforms),
    ...normalizePlatforms(item.publisherPlatforms),
    ...normalizePlatforms(item.publisher_platform),
    ...normalizePlatforms(snapshot.publisher_platform),
    ...normalizePlatforms(snapshot.publisherPlatforms),
  ];

  return uniqueStrings(platforms);
}

function normalizeCta(item: ApifyDatasetItem, text: string) {
  const snapshot = asRecord(item.snapshot);
  const cta = firstString(
    item.cta,
    item.callToAction,
    item.ctaText,
    item.call_to_action,
    snapshot.cta_text,
    snapshot.ctaText,
  );

  if (cta) {
    return cta;
  }

  const match = text.match(
    /\b(saiba mais|learn more|sign up|inscreva-se|comprar agora|shop now|download|baixar|ver mais|aplicar agora)\b/i,
  );

  return match?.[0] ?? "";
}

function extractPromise(text: string) {
  const cleaned = text.replace(/\s+/g, " ").trim();

  if (!cleaned) {
    return "";
  }

  const sentences = cleaned
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
  const promiseSentence =
    sentences.find((sentence) =>
      /aprenda|descubra|comece|transform|aument|melhor|venda|ganh|renda|learn|discover|start|boost|sell|grow|curso|metodo|m.todo|guia/i.test(
        sentence,
      ),
    ) ||
    sentences[0] ||
    cleaned;

  return promiseSentence.slice(0, 160);
}

function classifyAngle(text: string) {
  const normalized = normalizeText(text);

  if (/renda|ganh|lucro|profit|income|money|sell|vender/.test(normalized)) {
    return "renda extra";
  }

  if (/facil|rapido|simples|pratico|easy|quick|simple/.test(normalized)) {
    return "praticidade";
  }

  if (/transform|mudanca|antes e depois|resultado|change|become/.test(normalized)) {
    return "transformacao";
  }

  if (/hoje|agora|ultimas|vagas|limitad|today|now|limited/.test(normalized)) {
    return "urgencia";
  }

  if (/depoimento|prova|clientes|case|testimonial|reviews|social proof/.test(normalized)) {
    return "prova/social";
  }

  if (/segur|confi|tranquil|feliz|sonho|medo|confidence|peace/.test(normalized)) {
    return "beneficio emocional";
  }

  return "outro";
}

function relevanceScore(topic: string, text: string) {
  const topicWords = normalizeText(topic)
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word.length >= 3);

  if (topicWords.length === 0) {
    return 12;
  }

  const normalizedText = normalizeText(text);
  const matches = topicWords.filter((word) => normalizedText.includes(word));

  if (matches.length === 0) {
    return 8;
  }

  return Math.min(25, 12 + Math.round((matches.length / topicWords.length) * 13));
}

function startDateScore(startDate: string) {
  const timestamp = Date.parse(startDate);

  if (!Number.isFinite(timestamp)) {
    return 0;
  }

  const ageDays = (Date.now() - timestamp) / 86400000;

  if (ageDays >= 30) {
    return 20;
  }

  if (ageDays >= 14) {
    return 16;
  }

  if (ageDays >= 7) {
    return 12;
  }

  return 8;
}

function scoreAd(input: {
  topic: string;
  text: string;
  active: boolean;
  startDate: string;
  promise: string;
  cta: string;
  platforms: string[];
}) {
  const score =
    relevanceScore(input.topic, input.text) +
    (input.active ? 20 : 0) +
    startDateScore(input.startDate) +
    (input.promise ? 15 : 0) +
    (input.cta ? 10 : 0) +
    (input.platforms.length > 0 ? 10 : 0);

  return Math.max(0, Math.min(100, Math.round(score)));
}

function normalizeItem(item: ApifyDatasetItem, topic: string): MetaAdItem {
  const advertiser = normalizeAdvertiser(item);
  const text = normalizeAdText(item);
  const libraryLink = normalizeLibraryLink(item);
  const creativeUrl = normalizeCreativeUrl(item);
  const active = normalizeActive(item);
  const startDate = normalizeStartDate(item);
  const platforms = normalizeAdPlatforms(item);
  const cta = normalizeCta(item, text);
  const promise = extractPromise(text);
  const angle = classifyAngle(`${text} ${promise}`);
  const score = scoreAd({
    topic,
    text,
    active,
    startDate,
    promise,
    cta,
    platforms,
  });

  return {
    source: "meta_ads",
    rank: 0,
    advertiser,
    text,
    libraryLink,
    creativeUrl,
    active,
    startDate,
    platforms,
    promise,
    cta,
    angle,
    score,
    payload: item,
  };
}

function dedupeItems(items: MetaAdItem[]) {
  const seen = new Set<string>();

  return items.filter((item) => {
    const key =
      item.libraryLink ||
      `${item.advertiser.toLowerCase()}::${normalizeText(item.text).slice(0, 160)}`;

    if (!key || seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function sortAds(left: MetaAdItem, right: MetaAdItem) {
  if (right.score !== left.score) {
    return right.score - left.score;
  }

  if (left.active !== right.active) {
    return left.active ? -1 : 1;
  }

  const leftDate = Date.parse(left.startDate);
  const rightDate = Date.parse(right.startDate);

  if (Number.isFinite(leftDate) && Number.isFinite(rightDate)) {
    return leftDate - rightDate;
  }

  return 0;
}

function buildFallbackItems(topic: string): MetaAdItem[] {
  return [
    {
      source: "meta_ads",
      rank: 1,
      advertiser: "Mock Kitchen Lab",
      text: `Aprenda ${topic} com um metodo simples e validado.`,
      libraryLink: "https://www.facebook.com/ads/library/mock-001",
      creativeUrl: "",
      active: true,
      startDate: new Date().toISOString(),
      platforms: ["facebook", "instagram"],
      promise: "Aprenda com um metodo simples e validado.",
      cta: "Learn More",
      angle: "praticidade",
      score: 86,
      payload: {
        mode: "mock",
        reason: "meta_ads_unavailable",
      },
    },
    {
      source: "meta_ads",
      rank: 2,
      advertiser: "Mock Creator Academy",
      text: `O guia pratico para transformar ${topic} em renda.`,
      libraryLink: "https://www.facebook.com/ads/library/mock-002",
      creativeUrl: "",
      active: true,
      startDate: new Date().toISOString(),
      platforms: ["facebook", "instagram"],
      promise: "Transformar em renda.",
      cta: "Sign Up",
      angle: "renda extra",
      score: 82,
      payload: {
        mode: "mock",
        reason: "meta_ads_unavailable",
      },
    },
  ];
}

function fallbackResult(topic: string, error: string): MetaAdsResult {
  return {
    items: buildFallbackItems(topic),
    usedFallback: true,
    error,
  };
}

export async function searchMetaAds(input: {
  topic: string;
  language: string;
  period: string;
  expandedTerms: string[];
  maxResults?: number;
}): Promise<MetaAdsResult> {
  const sampleSize = input.maxResults ?? env.META_ADS_MAX_RESULTS;

  if (!env.META_ADS_ENABLED) {
    setMetaAdsApiStatus("pending");

    return fallbackResult(input.topic, "Meta Ads collection is disabled");
  }

  if (!env.APIFY_TOKEN) {
    setMetaAdsApiStatus("pending");

    return fallbackResult(input.topic, "Apify token is not configured");
  }

  if (!env.APIFY_META_ADS_ACTOR) {
    setMetaAdsApiStatus("pending");

    return fallbackResult(input.topic, "Apify Meta Ads actor is not configured");
  }

  try {
    const actorId = env.APIFY_META_ADS_ACTOR || DEFAULT_META_ADS_ACTOR;
    const queries = buildQueries(input);
    const urls = queries.map(buildAdLibraryUrl);
    const client = getApifyClient();
    const actorInput = {
      urls,
      scrapeAdDetails: false,
      limitPerSource: sampleSize,
      count: sampleSize,
      scrapePageAds: {
        activeStatus: "all",
        countryCode: "ALL",
        sortBy: "impressions_desc",
      },
    };

    console.info("[meta_ads] Apify actor starting", {
      actor: actorId,
      queryCount: queries.length,
      maxItems: sampleSize,
      country: "ALL",
    });

    const run = await client.actor(actorId).call(actorInput);
    const datasetId = run.defaultDatasetId;

    if (!datasetId) {
      throw new Error("Apify run did not return a default dataset");
    }

    const { items } = await client.dataset(datasetId).listItems();
    const datasetItems = items as ApifyDatasetItem[];
    const normalizedItems = datasetItems
      .map((item) => normalizeItem(item, input.topic))
      .filter((item) => item.text || item.advertiser || item.libraryLink);
    const dedupedItems = dedupeItems(normalizedItems);
    const selectedItems = dedupedItems
      .sort(sortAds)
      .slice(0, 10)
      .map((item, index) => ({
        ...item,
        rank: index + 1,
      }));

    console.info("[meta_ads] Apify actor completed", {
      actor: actorId,
      returnedItems: datasetItems.length,
      filteredItems: dedupedItems.length,
      savedItems: selectedItems.length,
    });

    setMetaAdsApiStatus("connected");

    return {
      items: selectedItems,
      usedFallback: false,
      returnedItems: datasetItems.length,
      filteredItems: dedupedItems.length,
    };
  } catch (error) {
    setMetaAdsApiStatus("error");
    logMetaAdsWarning("Apify Meta Ads fallback", error);

    const message =
      error instanceof Error
        ? error.message
        : "Apify Meta Ads Library Scraper unavailable";

    return fallbackResult(input.topic, message);
  }
}
