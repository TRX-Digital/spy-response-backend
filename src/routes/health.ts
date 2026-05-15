import { Router } from "express";
import { isOpenAIConfigured, isSupabaseConfigured } from "../env.js";

export const healthRouter = Router();

healthRouter.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: "spy-response-backend",
    version: "1.0.0",
    supabase: isSupabaseConfigured ? "configured" : "missing",
    openai: isOpenAIConfigured ? "connected" : "pending",
    timestamp: new Date().toISOString(),
  });
});
