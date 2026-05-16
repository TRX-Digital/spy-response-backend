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

export type KeywordExpansion = {
  expandedTerms: string[];
  hashtags: string[];
  commercialIntentTerms: string[];
  relatedQuestions: string[];
};

export type MarketDiagnosis = {
  productPotential: "high" | "medium" | "low";
  recommendation: "advance" | "evaluate" | "discard";
  opportunityScore: number;
  confidenceScore: number;
  audience: string;
  promise: string;
  pain: string;
  bestAngle: string;
  risks: string;
  nextStep: string;
  creativeIdeas: string[];
  vslIdeas: string[];
  productIdeas: string[];
};

export type ProductIdea = {
  name: string;
  type:
    | "course"
    | "guide"
    | "challenge"
    | "community"
    | "app"
    | "subscription"
    | "consulting"
    | "bundle"
    | "other";
  targetAudience: string;
  corePromise: string;
  mainPain: string;
  offerAngle: string;
  vslAngle: string;
  adHooks: string[];
  contentAngles: string[];
  difficulty: "low" | "medium" | "high";
  potential: "low" | "medium" | "high";
  risk: string;
  whyThisCouldWork: string;
  firstTest: string;
};

export type ProductIdeasResponse = {
  productIdeas: ProductIdea[];
  bestOpportunity: {
    name: string;
    reason: string;
    recommendedNextStep: string;
  };
};

export type MockSignals = {
  trends: Record<string, unknown>;
  tiktok: Record<string, unknown>[];
  youtube: Record<string, unknown>[];
  ads: Record<string, unknown>[];
};

export type ContentAnalysisInput = {
  contentId: string;
  source: string;
  title?: string;
  description?: string;
  metrics?: Record<string, unknown>;
  hashtags?: string[];
  topic?: string;
  language?: string;
};

export type ContentAnalysis = {
  hook: string;
  promise: string;
  pain: string;
  audience: string;
  format: string;
  whyItWorked: string;
  adaptAd: string;
  adaptVsl: string;
  adaptUgc: string;
  risks: string;
  tags: string[];
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
  productIdeas: ProductIdea[];
  bestOpportunity: ProductIdeasResponse["bestOpportunity"] | null;
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
