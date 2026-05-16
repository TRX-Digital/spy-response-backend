import { env, isYouTubeConfigured } from "../env.js";

type YouTubeDataApiStatus = "connected" | "error" | "pending";

type YouTubeSearchResponse = {
  items?: Array<{
    id?: {
      videoId?: string;
    };
  }>;
};

type YouTubeVideo = {
  id: string;
  snippet?: {
    title?: string;
    description?: string;
    channelTitle?: string;
    channelId?: string;
    publishedAt?: string;
    thumbnails?: Record<string, { url?: string } | undefined>;
  };
  contentDetails?: {
    duration?: string;
  };
  statistics?: {
    viewCount?: string;
    likeCount?: string;
    commentCount?: string;
  };
};

type YouTubeVideosResponse = {
  items?: YouTubeVideo[];
};

export type YouTubeShortItem = {
  source: "youtube_shorts";
  rank: number;
  title: string;
  description: string;
  channelTitle: string;
  channelId: string;
  videoId: string;
  link: string;
  thumbnail: string;
  publishedAt: string;
  durationSeconds: number | null;
  views: number;
  likes: number | null;
  comments: number | null;
  score: number;
  hashtags: string[];
  payload: unknown;
};

export type YouTubeShortsResult = {
  items: YouTubeShortItem[];
  usedFallback: boolean;
  error?: string;
};

let youtubeDataApiStatus: YouTubeDataApiStatus = "pending";

export function getYouTubeDataApiStatus(): YouTubeDataApiStatus {
  if (!isYouTubeConfigured) {
    return "pending";
  }

  return youtubeDataApiStatus;
}

function setYouTubeDataApiStatus(status: YouTubeDataApiStatus) {
  youtubeDataApiStatus = status;
}

function logYouTubeWarning(context: string, error: unknown) {
  const safeError =
    error instanceof Error
      ? { name: error.name, message: error.message }
      : { message: "Unknown YouTube Data API error" };

  console.warn(`[youtube] ${context}`, safeError);
}

function languageToRelevanceCode(language: string) {
  const normalized = language
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");

  if (normalized.includes("espanhol") || normalized.includes("spanish") || normalized.startsWith("es")) {
    return "es";
  }

  if (normalized.includes("portugues") || normalized.includes("portuguese") || normalized.startsWith("pt")) {
    return "pt";
  }

  if (normalized.includes("ingles") || normalized.includes("english") || normalized.startsWith("en")) {
    return "en";
  }

  return undefined;
}

function publishedAfterFromPeriod(period: string) {
  if (period === "all_time") {
    return undefined;
  }

  const days = Number(period);

  if (!Number.isFinite(days) || days <= 0) {
    return undefined;
  }

  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);

  return date.toISOString();
}

function buildQueries(input: {
  topic: string;
  expandedTerms: string[];
  hashtags: string[];
}) {
  const queries = [
    input.topic,
    ...input.expandedTerms.slice(0, 4),
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
    });
}

async function fetchYouTubeJson<T>(
  endpoint: "search" | "videos",
  params: Record<string, string>,
) {
  if (!env.YOUTUBE_API_KEY) {
    throw new Error("YouTube API key is not configured");
  }

  const url = new URL(`https://www.googleapis.com/youtube/v3/${endpoint}`);

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  url.searchParams.set("key", env.YOUTUBE_API_KEY);

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`YouTube Data API request failed with status ${response.status}`);
  }

  return (await response.json()) as T;
}

function parseDurationSeconds(duration: string | undefined) {
  if (!duration) {
    return null;
  }

  const match = duration.match(
    /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/,
  );

  if (!match) {
    return null;
  }

  const days = Number(match[1] ?? 0);
  const hours = Number(match[2] ?? 0);
  const minutes = Number(match[3] ?? 0);
  const seconds = Number(match[4] ?? 0);

  return days * 86400 + hours * 3600 + minutes * 60 + seconds;
}

function toNumber(value: string | undefined) {
  if (value === undefined) {
    return null;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : null;
}

function extractHashtags(text: string) {
  const matches = text.match(/#[\p{L}\p{N}_]+/gu) ?? [];
  const seen = new Set<string>();

  return matches.filter((hashtag) => {
    const key = hashtag.toLowerCase();

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function selectThumbnail(video: YouTubeVideo) {
  const thumbnails = video.snippet?.thumbnails;

  return (
    thumbnails?.maxres?.url ??
    thumbnails?.high?.url ??
    thumbnails?.medium?.url ??
    thumbnails?.default?.url ??
    ""
  );
}

function relativePoints(value: number | null, max: number, points: number) {
  if (!value || max <= 0) {
    return 0;
  }

  return Math.min(points, (value / max) * points);
}

function recencyPoints(publishedAt: string) {
  const timestamp = new Date(publishedAt).getTime();

  if (!Number.isFinite(timestamp)) {
    return 0;
  }

  const ageDays = (Date.now() - timestamp) / 86400000;

  if (ageDays <= 7) {
    return 5;
  }

  if (ageDays <= 30) {
    return 4;
  }

  if (ageDays <= 90) {
    return 2;
  }

  return 0;
}

function scoreVideos(videos: YouTubeShortItem[]) {
  const maxViews = Math.max(...videos.map((video) => video.views), 0);
  const maxLikes = Math.max(...videos.map((video) => video.likes ?? 0), 0);
  const maxComments = Math.max(...videos.map((video) => video.comments ?? 0), 0);

  return videos.map((video) => ({
    ...video,
    score: Math.round(
      Math.min(
        100,
        50 +
          relativePoints(video.views, maxViews, 30) +
          relativePoints(video.likes, maxLikes, 10) +
          relativePoints(video.comments, maxComments, 5) +
          recencyPoints(video.publishedAt),
      ),
    ),
  }));
}

function buildFallbackItems(topic: string, maxResults: number): YouTubeShortItem[] {
  const count = Math.min(Math.max(maxResults, 1), 3);

  return Array.from({ length: count }, (_, index) => {
    const rank = index + 1;
    const videoId = `mock-yt-${String(rank).padStart(3, "0")}`;

    return {
      source: "youtube_shorts",
      rank,
      title:
        rank === 1
          ? `Tutorial rapido de ${topic}`
          : `${rank} ideias curtas sobre ${topic}`,
      description:
        "Fallback mockado usado quando a YouTube Data API nao esta disponivel.",
      channelTitle: "Mock Channel",
      channelId: "mock-channel",
      videoId,
      link: `https://www.youtube.com/shorts/${videoId}`,
      thumbnail: `https://placehold.co/600x800?text=Shorts+Mock+${rank}`,
      publishedAt: new Date().toISOString(),
      durationSeconds: 45 + index * 15,
      views: 62000 - index * 9000,
      likes: 7100 - index * 800,
      comments: 230 - index * 30,
      score: 81 - index * 4,
      hashtags: ["#shorts", "#tutorial"],
      payload: {
        mode: "mock",
        reason: "youtube_unavailable",
      },
    };
  });
}

function fallbackResult(topic: string, maxResults: number, error: string): YouTubeShortsResult {
  return {
    items: buildFallbackItems(topic, maxResults),
    usedFallback: true,
    error,
  };
}

export async function searchYouTubeShorts(input: {
  topic: string;
  language: string;
  period: string;
  expandedTerms: string[];
  hashtags: string[];
  maxResults?: number;
}): Promise<YouTubeShortsResult> {
  const maxResults = input.maxResults ?? env.YOUTUBE_MAX_RESULTS;

  if (!env.YOUTUBE_API_KEY) {
    setYouTubeDataApiStatus("pending");

    return fallbackResult(input.topic, maxResults, "YouTube API key is not configured");
  }

  try {
    const relevanceLanguage = languageToRelevanceCode(input.language);
    const publishedAfter = publishedAfterFromPeriod(input.period);
    const queries = buildQueries(input);
    const videoIds = new Set<string>();

    for (const query of queries) {
      const params: Record<string, string> = {
        part: "snippet",
        type: "video",
        q: query,
        maxResults: "10",
        order: "viewCount",
        videoDuration: "short",
        safeSearch: "moderate",
      };

      if (relevanceLanguage) {
        params.relevanceLanguage = relevanceLanguage;
      }

      if (publishedAfter) {
        params.publishedAfter = publishedAfter;
      }

      const searchResult = await fetchYouTubeJson<YouTubeSearchResponse>(
        "search",
        params,
      );

      for (const item of searchResult.items ?? []) {
        if (item.id?.videoId) {
          videoIds.add(item.id.videoId);
        }
      }
    }

    const videoIdList = Array.from(videoIds);
    const videos: YouTubeVideo[] = [];

    for (let index = 0; index < videoIdList.length; index += 50) {
      const ids = videoIdList.slice(index, index + 50);

      if (ids.length === 0) {
        continue;
      }

      const videoResult = await fetchYouTubeJson<YouTubeVideosResponse>(
        "videos",
        {
          part: "snippet,contentDetails,statistics",
          id: ids.join(","),
        },
      );

      videos.push(...(videoResult.items ?? []));
    }

    console.info("[youtube] Data API videos fetched", {
      uniqueVideoIds: videoIdList.length,
      apiVideos: videos.length,
    });

    const mappedItems = videos.map((video) => {
      const title = video.snippet?.title ?? "";
      const description = video.snippet?.description ?? "";
      const publishedAt = video.snippet?.publishedAt ?? "";
      const durationSeconds = parseDurationSeconds(video.contentDetails?.duration);
      const views = toNumber(video.statistics?.viewCount) ?? 0;
      const likes = toNumber(video.statistics?.likeCount);
      const comments = toNumber(video.statistics?.commentCount);

      return {
        source: "youtube_shorts" as const,
        rank: 0,
        title,
        description,
        channelTitle: video.snippet?.channelTitle ?? "",
        channelId: video.snippet?.channelId ?? "",
        videoId: video.id,
        link: `https://www.youtube.com/shorts/${video.id}`,
        thumbnail: selectThumbnail(video),
        publishedAt,
        durationSeconds,
        views,
        likes,
        comments,
        score: 50,
        hashtags: extractHashtags(`${title} ${description}`),
        payload: video,
      };
    });

    const primaryShorts = mappedItems.filter(
      (video) => video.durationSeconds !== null && video.durationSeconds <= 180,
    );
    const backupShorts = mappedItems.filter(
      (video) =>
        video.durationSeconds !== null &&
        video.durationSeconds > 180 &&
        video.durationSeconds <= 240,
    );

    const shortItems =
      primaryShorts.length >= maxResults
        ? primaryShorts
        : [...primaryShorts, ...backupShorts];
    console.info("[youtube] Shorts filtered", {
      primaryShorts: primaryShorts.length,
      backupShorts: backupShorts.length,
      filteredShorts: shortItems.length,
    });

    const scoredItems = scoreVideos(shortItems)
      .sort((left, right) => {
        if (right.views !== left.views) {
          return right.views - left.views;
        }

        if ((right.likes ?? -1) !== (left.likes ?? -1)) {
          return (right.likes ?? -1) - (left.likes ?? -1);
        }

        return (right.comments ?? -1) - (left.comments ?? -1);
      })
      .slice(0, maxResults)
      .map((item, index) => ({
        ...item,
        rank: index + 1,
      }));

    setYouTubeDataApiStatus("connected");

    return {
      items: scoredItems,
      usedFallback: false,
    };
  } catch (error) {
    setYouTubeDataApiStatus("error");
    logYouTubeWarning("shorts search fallback", error);

    const message =
      error instanceof Error ? error.message : "YouTube Data API unavailable";

    return fallbackResult(input.topic, maxResults, message);
  }
}
