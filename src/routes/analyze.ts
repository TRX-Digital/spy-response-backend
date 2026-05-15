import { Router } from "express";
import { z } from "zod";
import { authMiddleware } from "../middleware/auth.js";
import { generateContentAnalysis } from "../services/ai-market-analysis.js";
import { buildMockContentAnalysis } from "../services/mock-search.js";
import { logOpenAIWarning } from "../services/openai-client.js";
import { HttpError } from "../types.js";

const analyzeSchema = z.object({
  contentId: z.string().trim().min(1),
  source: z.string().trim().min(1),
  title: z.string().trim().optional(),
  description: z.string().trim().optional(),
  metrics: z.record(z.string(), z.unknown()).optional(),
  hashtags: z.array(z.string().trim().min(1)).optional(),
  topic: z.string().trim().optional(),
  language: z.string().trim().optional(),
});

export const analyzeRouter = Router();

analyzeRouter.post("/analyze/content", authMiddleware, async (req, res, next) => {
  try {
    const parsedBody = analyzeSchema.safeParse(req.body);

    if (!parsedBody.success) {
      throw new HttpError(400, "Invalid request body", parsedBody.error.flatten());
    }

    const analysis = await generateContentAnalysis(parsedBody.data).catch((error) => {
      logOpenAIWarning("content analysis fallback", error);

      return buildMockContentAnalysis(parsedBody.data);
    });

    res.json(analysis);
  } catch (error) {
    next(error);
  }
});
