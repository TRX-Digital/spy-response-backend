import { Router } from "express";
import { isSupabaseConfigured } from "../env.js";

export const healthRouter = Router();

healthRouter.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: "spy-response-backend",
    version: "1.0.0",
    supabase: isSupabaseConfigured ? "configured" : "missing",
    timestamp: new Date().toISOString(),
  });
});
