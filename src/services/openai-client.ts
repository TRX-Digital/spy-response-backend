import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import { env, isOpenAIConfigured } from "../env.js";

let openAIClient: OpenAI | null = null;

export const defaultOpenAIModel = env.OPENAI_MODEL || "gpt-5.4-mini";
export const deepOpenAIModel = env.OPENAI_DEEP_MODEL || "gpt-5.5";

export function getOpenAIClient() {
  if (!isOpenAIConfigured || !env.OPENAI_API_KEY) {
    throw new Error("OpenAI API key is not configured");
  }

  if (!openAIClient) {
    openAIClient = new OpenAI({
      apiKey: env.OPENAI_API_KEY,
    });
  }

  return openAIClient;
}

export function logOpenAIWarning(context: string, error: unknown) {
  const safeError =
    error instanceof Error
      ? { name: error.name, message: error.message }
      : { message: "Unknown OpenAI error" };

  console.warn(`[openai] ${context}`, safeError);
}

export async function createStructuredResponse<T>({
  model = defaultOpenAIModel,
  instructions,
  input,
  schema,
  schemaName,
}: {
  model?: string;
  instructions: string;
  input: string;
  schema: z.ZodType<T>;
  schemaName: string;
}): Promise<T> {
  const client = getOpenAIClient();

  const response = await client.responses.parse({
    model,
    instructions,
    input,
    store: false,
    text: {
      format: zodTextFormat(schema, schemaName),
    },
  });

  if (!response.output_parsed) {
    throw new Error("OpenAI response did not include parsed JSON");
  }

  return response.output_parsed;
}
