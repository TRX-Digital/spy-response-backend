export type SearchPeriod = "7" | "15" | "30" | "90" | "all_time";

export type AuthenticatedUser = {
  id: string;
  email: string | null;
};

export type SearchInput = {
  topic: string;
  language: string;
  period: SearchPeriod;
};

export type SourceResult = {
  source?: string | null;
  [key: string]: unknown;
};

export type SearchDetails = {
  search: Record<string, unknown>;
  keywordExpansions: Record<string, unknown>[];
  trendResults: Record<string, unknown> | null;
  sourceResults: Record<string, SourceResult[]>;
  adResults: Record<string, unknown>[];
  marketDiagnosis: Record<string, unknown> | null;
  auditLogs: Record<string, unknown>[];
};

export class HttpError extends Error {
  public readonly statusCode: number;
  public readonly details?: unknown;

  constructor(statusCode: number, message: string, details?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
  }
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}
