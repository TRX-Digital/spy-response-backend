import { Router } from "express";
import {
  isOpenAIConfigured,
  isSupabaseConfigured,
} from "../env.js";
import { getSerpApiGoogleTrendsStatus } from "../services/serpapi-trends-service.js";
import { getYouTubeDataApiStatus } from "../services/youtube-service.js";

export const healthRouter = Router();

healthRouter.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: "spy-response-backend",
    version: "1.0.0",
    supabase: isSupabaseConfigured ? "configured" : "missing",
    openai: isOpenAIConfigured ? "connected" : "pending",
    youtube_data_api: getYouTubeDataApiStatus(),
    serpapi_google_trends: getSerpApiGoogleTrendsStatus(),
    api_settings: {
      openai: isOpenAIConfigured ? "connected" : "pending",
      youtube_data_api: getYouTubeDataApiStatus(),
      serpapi_google_trends: getSerpApiGoogleTrendsStatus(),
    },
    timestamp: new Date().toISOString(),
  });
});
