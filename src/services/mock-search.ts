import type { SearchInput } from "../types.js";

const randomScore = () => Math.floor(Math.random() * 21) + 70;

export function buildMockSearch(input: SearchInput, userId: string) {
  const score = randomScore();
  const confidence = randomScore();

  return {
    user_id: userId,
    topic: input.topic,
    language: input.language,
    period: input.period,
    score,
    confidence,
    recommendation: "advance",
    results_count: 30,
    collect_status: "complete",
    strongest_source: "tiktok",
  };
}

export function buildMockKeywordExpansions(searchId: string, topic: string) {
  return [
    {
      search_id: searchId,
      keyword: topic,
      expansion_type: "seed",
      volume_score: 88,
      competition_score: 52,
      opportunity_score: 86,
    },
    {
      search_id: searchId,
      keyword: `${topic} facil`,
      expansion_type: "long_tail",
      volume_score: 82,
      competition_score: 45,
      opportunity_score: 84,
    },
    {
      search_id: searchId,
      keyword: `${topic} em casa`,
      expansion_type: "buyer_intent",
      volume_score: 79,
      competition_score: 48,
      opportunity_score: 81,
    },
    {
      search_id: searchId,
      keyword: `${topic} passo a passo`,
      expansion_type: "tutorial",
      volume_score: 74,
      competition_score: 41,
      opportunity_score: 78,
    },
  ];
}

export function buildMockTrendResults(searchId: string, topic: string) {
  return [
    {
      search_id: searchId,
      source: "tiktok",
      title: `Videos curtos sobre ${topic} com prova visual`,
      trend_score: 89,
      velocity_score: 84,
      volume_score: 91,
      summary: "Conteudos com transformacao rapida e bastidores vendem melhor.",
      metadata: {
        detected_hooks: ["resultado em 3 dias", "sem experiencia", "baixo custo"],
      },
    },
    {
      search_id: searchId,
      source: "youtube_shorts",
      title: `Shorts educativos para ${topic}`,
      trend_score: 81,
      velocity_score: 76,
      volume_score: 83,
      summary: "Tutoriais diretos estao puxando buscas de alta intencao.",
      metadata: {
        detected_hooks: ["tutorial simples", "antes e depois", "receita lucrativa"],
      },
    },
  ];
}

export function buildMockSourceResults(searchId: string, topic: string) {
  return [
    {
      search_id: searchId,
      source: "tiktok",
      content_id: "mock-tiktok-001",
      title: `Como comecei com ${topic}`,
      url: "https://www.tiktok.com/@mock/video/001",
      author: "@mock_creator",
      views: 184000,
      likes: 21400,
      comments: 920,
      shares: 3400,
      engagement_rate: 13.97,
      hook: "Parei de vender do jeito errado e testei isso aqui.",
      posted_at: new Date().toISOString(),
      metadata: {
        format: "ugc",
        duration_seconds: 32,
      },
    },
    {
      search_id: searchId,
      source: "tiktok",
      content_id: "mock-tiktok-002",
      title: `3 ideias de ${topic} que vendem todo dia`,
      url: "https://www.tiktok.com/@mock/video/002",
      author: "@mock_seller",
      views: 97000,
      likes: 11200,
      comments: 410,
      shares: 1600,
      engagement_rate: 13.62,
      hook: "Se eu fosse recomecar hoje, faria so esses 3 modelos.",
      posted_at: new Date().toISOString(),
      metadata: {
        format: "listicle",
        duration_seconds: 41,
      },
    },
    {
      search_id: searchId,
      source: "youtube_shorts",
      content_id: "mock-yt-001",
      title: `Tutorial rapido de ${topic}`,
      url: "https://www.youtube.com/shorts/mock001",
      author: "Mock Channel",
      views: 62000,
      likes: 7100,
      comments: 230,
      shares: 840,
      engagement_rate: 13.17,
      hook: "O passo que quase todo iniciante pula.",
      posted_at: new Date().toISOString(),
      metadata: {
        format: "tutorial",
        duration_seconds: 51,
      },
    },
  ];
}

export function buildMockAdResults(searchId: string, topic: string) {
  return [
    {
      search_id: searchId,
      platform: "meta",
      advertiser: "Mock Kitchen Lab",
      primary_text: `Aprenda ${topic} com um metodo simples e validado.`,
      headline: "Comece com pouco investimento",
      cta: "Learn More",
      destination_url: "https://example.com/mock-offer",
      creative_type: "ugc_video",
      score: 86,
      impressions_estimate: 120000,
      spend_estimate: 2400,
      metadata: {
        angle: "income_opportunity",
        funnel_stage: "cold",
      },
    },
    {
      search_id: searchId,
      platform: "meta",
      advertiser: "Mock Creator Academy",
      primary_text: `O guia pratico para transformar ${topic} em renda.`,
      headline: "Aula gratuita hoje",
      cta: "Sign Up",
      destination_url: "https://example.com/mock-webinar",
      creative_type: "vsl_cut",
      score: 82,
      impressions_estimate: 89000,
      spend_estimate: 1800,
      metadata: {
        angle: "free_training",
        funnel_stage: "lead",
      },
    },
  ];
}

export function buildMockMarketDiagnosis(searchId: string, topic: string) {
  return {
    search_id: searchId,
    summary: `${topic} mostra demanda consistente, boa resposta a criativos UGC e espaco para oferta educativa simples.`,
    demand_level: "high",
    competition_level: "medium",
    opportunity_score: 84,
    saturation_score: 46,
    recommendation: "advance",
    angles: [
      "baixo investimento inicial",
      "resultado visual rapido",
      "passo a passo para iniciantes",
    ],
    risks: [
      "criativos genericos saturam rapido",
      "promessa precisa ser realista",
    ],
    next_steps: [
      "testar 3 hooks UGC",
      "validar pagina com prova visual",
      "criar VSL curta com demonstracao",
    ],
  };
}

export function buildMockAuditLogs(searchId: string) {
  return [
    {
      search_id: searchId,
      source: "tiktok",
      status: "complete",
      records_collected: 18,
      message: "Mock TikTok collection completed.",
      metadata: {
        mode: "mock",
      },
    },
    {
      search_id: searchId,
      source: "youtube_shorts",
      status: "complete",
      records_collected: 12,
      message: "Mock YouTube Shorts collection completed.",
      metadata: {
        mode: "mock",
      },
    },
    {
      search_id: searchId,
      source: "meta_ads",
      status: "complete",
      records_collected: 2,
      message: "Mock Meta Ads collection completed.",
      metadata: {
        mode: "mock",
      },
    },
  ];
}
