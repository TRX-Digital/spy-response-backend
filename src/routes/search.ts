import { Router } from "express";
import { z } from "zod";
import { authMiddleware } from "../middleware/auth.js";
import { createSearchWithMocks, getSearchDetails } from "../services/search-service.js";
import { HttpError } from "../types.js";

const searchSchema = z.object({
  topic: z.string().trim().min(2),
  language: z.string().trim().min(1),
  period: z.enum(["7", "15", "30", "90", "all_time"]),
});

const paramsSchema = z.object({
  id: z.string().trim().min(1),
});

export const searchRouter = Router();

searchRouter.post("/search", authMiddleware, async (req, res, next) => {
  try {
    const parsedBody = searchSchema.safeParse(req.body);

    if (!parsedBody.success) {
      throw new HttpError(400, "Invalid request body", parsedBody.error.flatten());
    }

    if (!req.user) {
      throw new HttpError(401, "Unauthorized");
    }

    const searchId = await createSearchWithMocks(parsedBody.data, req.user.id);

    res.status(201).json({ searchId });
  } catch (error) {
    next(error);
  }
});

searchRouter.get("/search/:id", authMiddleware, async (req, res, next) => {
  try {
    const parsedParams = paramsSchema.safeParse(req.params);

    if (!parsedParams.success) {
      throw new HttpError(400, "Invalid search id", parsedParams.error.flatten());
    }

    if (!req.user) {
      throw new HttpError(401, "Unauthorized");
    }

    const details = await getSearchDetails(parsedParams.data.id, req.user.id);

    res.json(details);
  } catch (error) {
    next(error);
  }
});
