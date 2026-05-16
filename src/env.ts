import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const emptyStringToUndefined = (value: unknown) => {
  if (typeof value === "string" && value.trim() === "") {
    return undefined;
  }

  return value;
};

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  SUPABASE_URL: z.preprocess(
    emptyStringToUndefined,
    z.string().url().optional(),
  ),
  SUPABASE_SERVICE_ROLE_KEY: z.preprocess(
    emptyStringToUndefined,
    z.string().min(1).optional(),
  ),
  SUPABASE_JWT_SECRET: z.preprocess(
    emptyStringToUndefined,
    z.string().min(1).optional(),
  ),
  FRONTEND_URL: z.preprocess(
    emptyStringToUndefined,
    z.string().min(1).optional(),
  ),
  OPENAI_API_KEY: z.preprocess(
    emptyStringToUndefined,
    z.string().min(1).optional(),
  ),
  OPENAI_MODEL: z.preprocess(
    emptyStringToUndefined,
    z.string().min(1).default("gpt-5.4-mini"),
  ),
  OPENAI_DEEP_MODEL: z.preprocess(
    emptyStringToUndefined,
    z.string().min(1).default("gpt-5.5"),
  ),
  YOUTUBE_API_KEY: z.preprocess(
    emptyStringToUndefined,
    z.string().min(1).optional(),
  ),
  YOUTUBE_MAX_RESULTS: z.preprocess(
    emptyStringToUndefined,
    z.coerce.number().int().positive().max(50).default(10),
  ),
  SERPAPI_KEY: z.preprocess(
    emptyStringToUndefined,
    z.string().min(1).optional(),
  ),
  SERPAPI_MAX_QUERIES: z.preprocess(
    emptyStringToUndefined,
    z.coerce.number().int().positive().max(5).default(3),
  ),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error("Invalid environment configuration", parsedEnv.error.flatten());
  process.exit(1);
}

export const env = parsedEnv.data;

export const isSupabaseConfigured = Boolean(
  env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY,
);

export const isOpenAIConfigured = Boolean(env.OPENAI_API_KEY);

export const isYouTubeConfigured = Boolean(env.YOUTUBE_API_KEY);

export const isSerpApiConfigured = Boolean(env.SERPAPI_KEY);
