import { Router } from "express";
import { isOpenAIConfigured, isSupabaseConfigured } from "../env.js";
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
    api_settings: {
      openai: isOpenAIConfigured ? "connected" : "pending",
      youtube_data_api: getYouTubeDataApiStatus(),
    },
    timestamp: new Date().toISOString(),
  });
});
