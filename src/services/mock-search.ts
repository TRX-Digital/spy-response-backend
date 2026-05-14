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
      term: topic,
      kind: "keyword",
    },
    {
      search_id: searchId,
      term: `#${topic.replace(/\s+/g, "")}`,
      kind: "hashtag",
    },
    {
      search_id: searchId,
      term: `${topic} facil`,
      kind: "variation",
    },
    {
      search_id: searchId,
      term: `${topic} para vender`,
      kind: "commercial_intent",
    },
    {
      search_id: searchId,
      term: `como comecar com ${topic}?`,
      kind: "related_question",
    },
  ];
}

export function buildMockTrendResults(searchId: string, topic: string) {
  return {
    search_id: searchId,
    status: "complete",
    series: [
      { label: "Semana 1", score: 72 },
      { label: "Semana 2", score: 78 },
      { label: "Semana 3", score: 84 },
      { label: "Semana 4", score: 88 },
    ],
    related: [
      `${topic} facil`,
      `${topic} para vender`,
      `${topic} em casa`,
    ],
    rising: [
      `${topic} rapido`,
      `${topic} lucrativo`,
      `${topic} passo a passo`,
    ],
    variations: [
      `${topic} simples`,
      `${topic} iniciante`,
      `${topic} baixo custo`,
    ],
    reading: "Demanda em alta com sinais fortes de interesse por tutoriais simples e prova visual.",
  };
}

export function buildMockSourceResults(searchId: string, topic: string) {
  return [
    {
      search_id: searchId,
      source: "tiktok",
      rank: 1,
      title: `Como comecei com ${topic}`,
      link: "https://www.tiktok.com/@mock/video/001",
      thumbnail: "https://placehold.co/600x800?text=TikTok+Mock+1",
      score: 89,
      payload: {
        author: "@mock_creator",
        views: 184000,
        likes: 21400,
        comments: 920,
        shares: 3400,
        hook: "Parei de vender do jeito errado e testei isso aqui.",
        format: "ugc",
        duration_seconds: 32,
      },
    },
    {
      search_id: searchId,
      source: "tiktok",
      rank: 2,
      title: `3 ideias de ${topic} que vendem todo dia`,
      link: "https://www.tiktok.com/@mock/video/002",
      thumbnail: "https://placehold.co/600x800?text=TikTok+Mock+2",
      score: 84,
      payload: {
        author: "@mock_seller",
        views: 97000,
        likes: 11200,
        comments: 410,
        shares: 1600,
        hook: "Se eu fosse recomecar hoje, faria so esses 3 modelos.",
        format: "listicle",
        duration_seconds: 41,
      },
    },
    {
      search_id: searchId,
      source: "youtube_shorts",
      rank: 1,
      title: `Tutorial rapido de ${topic}`,
      link: "https://www.youtube.com/shorts/mock001",
      thumbnail: "https://placehold.co/600x800?text=Shorts+Mock+1",
      score: 81,
      payload: {
        author: "Mock Channel",
        views: 62000,
        likes: 7100,
        comments: 230,
        shares: 840,
        hook: "O passo que quase todo iniciante pula.",
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
      advertiser: "Mock Kitchen Lab",
      text: `Aprenda ${topic} com um metodo simples e validado.`,
      library_link: "https://www.facebook.com/ads/library/mock-001",
      active: true,
      start_date: new Date().toISOString(),
      platforms: ["facebook", "instagram"],
      promise: "Comece com pouco investimento",
      cta: "Learn More",
      angle: "income_opportunity",
      score: 86,
      payload: {
        creative_type: "ugc_video",
        funnel_stage: "cold",
      },
    },
    {
      search_id: searchId,
      advertiser: "Mock Creator Academy",
      text: `O guia pratico para transformar ${topic} em renda.`,
      library_link: "https://www.facebook.com/ads/library/mock-002",
      active: true,
      start_date: new Date().toISOString(),
      platforms: ["facebook", "instagram"],
      promise: "Aula gratuita hoje",
      cta: "Sign Up",
      angle: "free_training",
      score: 82,
      payload: {
        creative_type: "vsl_cut",
        funnel_stage: "lead",
      },
    },
  ];
}

export function buildMockMarketDiagnosis(searchId: string, topic: string) {
  return {
    search_id: searchId,
    product_potential: `${topic} mostra demanda consistente e boa resposta a criativos UGC.`,
    audience: "Iniciantes que buscam renda extra com baixo investimento inicial.",
    promise: "Transformar uma habilidade simples em oportunidade pratica de renda.",
    pain: "A audiencia quer vender, mas nao sabe por onde comecar nem como se diferenciar.",
    best_angle: "baixo investimento inicial com resultado visual rapido",
    risks: [
      "criativos genericos saturam rapido",
      "promessa precisa ser realista",
    ],
    next_step: "Testar 3 hooks UGC e validar a pagina com prova visual.",
  };
}

export function buildMockAuditLogs(searchId: string) {
  return [
    {
      search_id: searchId,
      severity: "info",
      source: "tiktok",
      message: "Mock TikTok collection completed.",
    },
    {
      search_id: searchId,
      severity: "info",
      source: "youtube_shorts",
      message: "Mock YouTube Shorts collection completed.",
    },
    {
      search_id: searchId,
      severity: "info",
      source: "meta_ads",
      message: "Mock Meta Ads collection completed.",
    },
  ];
}
