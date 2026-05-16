import { z } from "zod";
import { SPY_RESPONSE_STRATEGY_PROMPT } from "../prompts/spy-response-strategy.js";
import type { ProductIdea, ProductIdeasResponse } from "../types.js";
import { createStructuredResponse, deepOpenAIModel } from "./openai-client.js";

const productIdeaSchema = z
  .object({
    name: z.string().trim().min(1),
    type: z.enum([
      "course",
      "guide",
      "challenge",
      "community",
      "app",
      "subscription",
      "consulting",
      "bundle",
      "other",
    ]),
    targetAudience: z.string().trim().min(1),
    corePromise: z.string().trim().min(1),
    mainPain: z.string().trim().min(1),
    offerAngle: z.string().trim().min(1),
    vslAngle: z.string().trim().min(1),
    adHooks: z.array(z.string().trim().min(1)).min(3).max(3),
    contentAngles: z.array(z.string().trim().min(1)).min(3).max(3),
    difficulty: z.enum(["low", "medium", "high"]),
    potential: z.enum(["low", "medium", "high"]),
    risk: z.string().trim().min(1),
    whyThisCouldWork: z.string().trim().min(1),
    firstTest: z.string().trim().min(1),
  })
  .strict();

const productIdeasSchema = z
  .object({
    productIdeas: z.array(productIdeaSchema).min(3).max(5),
    bestOpportunity: z
      .object({
        name: z.string().trim().min(1),
        reason: z.string().trim().min(1),
        recommendedNextStep: z.string().trim().min(1),
      })
      .strict(),
  })
  .strict();

function languageFamily(language?: string) {
  const normalized = (language || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");

  if (
    normalized.includes("espanhol") ||
    normalized.includes("spanish") ||
    normalized.startsWith("es")
  ) {
    return "es";
  }

  if (
    normalized.includes("ingles") ||
    normalized.includes("english") ||
    normalized.startsWith("en")
  ) {
    return "en";
  }

  return "pt";
}

function idea(
  input: Omit<ProductIdea, "adHooks" | "contentAngles"> & {
    adHooks: [string, string, string];
    contentAngles: [string, string, string];
  },
): ProductIdea {
  return input;
}

export function buildMockProductIdeas(
  topic: string,
  language?: string,
): ProductIdeasResponse {
  const family = languageFamily(language);

  if (family === "es") {
    const productIdeas = [
      idea({
        name: `Guia practico de ${topic}`,
        type: "guide",
        targetAudience: "Principiantes que quieren entender el tema antes de invertir mucho tiempo.",
        corePromise: `Organizar un primer camino practico para probar ${topic} con bajo riesgo.`,
        mainPain: "Falta de claridad sobre por donde empezar y que pasos seguir.",
        offerAngle: "Primeros pasos simples con checklist accionable.",
        vslAngle: "Del caos inicial a un plan claro de validacion.",
        adHooks: [
          `No empieces con ${topic} sin este mapa simple`,
          `3 errores comunes al probar ${topic}`,
          `Como validar ${topic} sin promesas exageradas`,
        ],
        contentAngles: [
          "Errores de principiantes",
          "Checklist de validacion",
          "Paso a paso visual",
        ],
        difficulty: "low",
        potential: "medium",
        risk: "Puede necesitar mas senales reales antes de escalar trafico.",
        whyThisCouldWork: "Es una oferta simple de entender y facil de probar con una pagina corta.",
        firstTest: "Lanzar un anuncio white con checklist gratuito y medir registros.",
      }),
      idea({
        name: `Reto 7 dias de ${topic}`,
        type: "challenge",
        targetAudience: "Personas que necesitan acompanamiento corto para tomar accion.",
        corePromise: `Crear una primera rutina de accion alrededor de ${topic}.`,
        mainPain: "Procrastinacion y exceso de informacion.",
        offerAngle: "Reto guiado, simple y con tareas diarias.",
        vslAngle: "Una semana para salir de la confusion y crear el primer sistema.",
        adHooks: [
          `Prueba ${topic} durante 7 dias con esta estructura`,
          `Si te abruma ${topic}, empieza por aqui`,
          `Un reto simple para validar ${topic}`,
        ],
        contentAngles: [
          "Dia 1 del reto",
          "Antes y despues del proceso",
          "Tarea diaria simple",
        ],
        difficulty: "medium",
        potential: "medium",
        risk: "Requiere buena entrega para evitar abandono.",
        whyThisCouldWork: "El formato de reto reduce friccion y permite validar interes rapido.",
        firstTest: "Crear VSL corta con invitacion al reto y prueba de bajo ticket.",
      }),
      idea({
        name: `Mini curso de ${topic}`,
        type: "course",
        targetAudience: "Audiencia que busca una transformacion clara y compacta.",
        corePromise: `Aprender el metodo base para aplicar ${topic} con pasos simples.`,
        mainPain: "No saber que metodo seguir ni como evitar errores comunes.",
        offerAngle: "Metodo compacto para principiantes.",
        vslAngle: "El camino mas simple para empezar sin depender de soluciones complejas.",
        adHooks: [
          `El metodo simple para empezar con ${topic}`,
          `Lo que hubiera querido saber antes de probar ${topic}`,
          `Una forma mas clara de aprender ${topic}`,
        ],
        contentAngles: [
          "Modulo 1 resumido",
          "Mitos del tema",
          "Caso de uso simple",
        ],
        difficulty: "medium",
        potential: "high",
        risk: "La promesa debe mantenerse especifica y comprobable.",
        whyThisCouldWork: "Curso corto puede ser vendido por VSL y permite upsell futuro.",
        firstTest: "Validar una VSL de 6 a 8 minutos con 3 creativos UGC.",
      }),
    ];

    return {
      productIdeas,
      bestOpportunity: {
        name: productIdeas[0]?.name ?? `Guia practico de ${topic}`,
        reason: "Es la oferta mas simple para validar sin depender de claims agresivos.",
        recommendedNextStep: "Probar una landing page con checklist y un creativo UGC.",
      },
    };
  }

  if (family === "en") {
    const productIdeas = [
      idea({
        name: `${topic} practical guide`,
        type: "guide",
        targetAudience: "Beginners who want a clear first path before investing more time.",
        corePromise: `Organize a practical low-risk path to test ${topic}.`,
        mainPain: "Lack of clarity about where to start and what steps to follow.",
        offerAngle: "Simple first steps with an actionable checklist.",
        vslAngle: "From confusion to a clear validation plan.",
        adHooks: [
          `Do not start ${topic} without this simple map`,
          `3 common mistakes when testing ${topic}`,
          `How to validate ${topic} without aggressive claims`,
        ],
        contentAngles: [
          "Beginner mistakes",
          "Validation checklist",
          "Visual step by step",
        ],
        difficulty: "low",
        potential: "medium",
        risk: "It may need more real signals before scaling paid traffic.",
        whyThisCouldWork: "It is simple to explain and easy to test with a short page.",
        firstTest: "Launch a white-ad checklist lead magnet and measure opt-ins.",
      }),
      idea({
        name: `7-day ${topic} challenge`,
        type: "challenge",
        targetAudience: "People who need a short guided push to take action.",
        corePromise: `Build a first action routine around ${topic}.`,
        mainPain: "Procrastination and information overload.",
        offerAngle: "Guided challenge with simple daily tasks.",
        vslAngle: "One week to move from confusion to a first working system.",
        adHooks: [
          `Try ${topic} for 7 days with this structure`,
          `If ${topic} feels overwhelming, start here`,
          `A simple challenge to validate ${topic}`,
        ],
        contentAngles: [
          "Day 1 of the challenge",
          "Before and after process",
          "Simple daily task",
        ],
        difficulty: "medium",
        potential: "medium",
        risk: "Needs strong delivery to avoid drop-off.",
        whyThisCouldWork: "The challenge format reduces friction and validates intent quickly.",
        firstTest: "Create a short VSL inviting users into a low-ticket challenge.",
      }),
      idea({
        name: `${topic} starter course`,
        type: "course",
        targetAudience: "People looking for a compact and clear transformation.",
        corePromise: `Learn the base method to apply ${topic} in simple steps.`,
        mainPain: "Not knowing which method to follow or which mistakes to avoid.",
        offerAngle: "Compact beginner method.",
        vslAngle: "The simplest path to start without complex systems.",
        adHooks: [
          `The simple method to start ${topic}`,
          `What I wish I knew before testing ${topic}`,
          `A clearer way to learn ${topic}`,
        ],
        contentAngles: [
          "Module 1 summary",
          "Topic myths",
          "Simple use case",
        ],
        difficulty: "medium",
        potential: "high",
        risk: "The promise must remain specific and provable.",
        whyThisCouldWork: "A short course can be sold by VSL and allows future upsells.",
        firstTest: "Validate a 6 to 8 minute VSL with 3 UGC creatives.",
      }),
    ];

    return {
      productIdeas,
      bestOpportunity: {
        name: productIdeas[0]?.name ?? `${topic} practical guide`,
        reason: "It is the simplest offer to validate without aggressive claims.",
        recommendedNextStep: "Test a landing page with a checklist and one UGC creative.",
      },
    };
  }

  const productIdeas = [
    idea({
      name: `Guia pratico de ${topic}`,
      type: "guide",
      targetAudience: "Iniciantes que querem entender o tema antes de investir muito tempo.",
      corePromise: `Organizar um primeiro caminho pratico para testar ${topic} com baixo risco.`,
      mainPain: "Falta de clareza sobre por onde comecar e quais passos seguir.",
      offerAngle: "Primeiros passos simples com checklist acionavel.",
      vslAngle: "Da confusao inicial para um plano claro de validacao.",
      adHooks: [
        `Nao comece com ${topic} sem este mapa simples`,
        `3 erros comuns ao testar ${topic}`,
        `Como validar ${topic} sem promessas exageradas`,
      ],
      contentAngles: [
        "Erros de iniciantes",
        "Checklist de validacao",
        "Passo a passo visual",
      ],
      difficulty: "low",
      potential: "medium",
      risk: "Pode precisar de mais sinais reais antes de escalar trafego.",
      whyThisCouldWork: "E uma oferta simples de explicar e facil de testar com pagina curta.",
      firstTest: "Rodar um anuncio white para um checklist gratuito e medir cadastros.",
    }),
    idea({
      name: `Desafio 7 dias de ${topic}`,
      type: "challenge",
      targetAudience: "Pessoas que precisam de acompanhamento curto para tomar acao.",
      corePromise: `Criar uma primeira rotina de acao em torno de ${topic}.`,
      mainPain: "Procrastinacao e excesso de informacao.",
      offerAngle: "Desafio guiado, simples e com tarefas diarias.",
      vslAngle: "Uma semana para sair da confusao e criar o primeiro sistema.",
      adHooks: [
        `Teste ${topic} por 7 dias com esta estrutura`,
        `Se ${topic} parece confuso, comece por aqui`,
        `Um desafio simples para validar ${topic}`,
      ],
      contentAngles: [
        "Dia 1 do desafio",
        "Antes e depois do processo",
        "Tarefa diaria simples",
      ],
      difficulty: "medium",
      potential: "medium",
      risk: "Exige boa entrega para evitar abandono.",
      whyThisCouldWork: "O formato de desafio reduz friccao e valida interesse rapido.",
      firstTest: "Criar uma VSL curta convidando para um desafio low ticket.",
    }),
    idea({
      name: `Mini curso de ${topic}`,
      type: "course",
      targetAudience: "Publico que busca uma transformacao clara e compacta.",
      corePromise: `Aprender o metodo base para aplicar ${topic} com passos simples.`,
      mainPain: "Nao saber qual metodo seguir nem como evitar erros comuns.",
      offerAngle: "Metodo compacto para iniciantes.",
      vslAngle: "O caminho mais simples para comecar sem depender de sistemas complexos.",
      adHooks: [
        `O metodo simples para comecar com ${topic}`,
        `O que eu queria saber antes de testar ${topic}`,
        `Uma forma mais clara de aprender ${topic}`,
      ],
      contentAngles: [
        "Resumo do modulo 1",
        "Mitos do tema",
        "Caso de uso simples",
      ],
      difficulty: "medium",
      potential: "high",
      risk: "A promessa precisa ser especifica e comprovavel.",
      whyThisCouldWork: "Curso curto pode ser vendido por VSL e permite upsell futuro.",
      firstTest: "Validar uma VSL de 6 a 8 minutos com 3 criativos UGC.",
    }),
  ];

  return {
    productIdeas,
    bestOpportunity: {
      name: productIdeas[0]?.name ?? `Guia pratico de ${topic}`,
      reason: "E a oferta mais simples para validar sem depender de claims agressivos.",
      recommendedNextStep: "Testar uma landing page com checklist e um criativo UGC.",
    },
  };
}

function normalizeProductIdeas(
  result: ProductIdeasResponse,
): ProductIdeasResponse {
  return {
    productIdeas: result.productIdeas.slice(0, 5),
    bestOpportunity: result.bestOpportunity,
  };
}

export async function generateProductIdeas(input: {
  topic: string;
  language: string;
  period: string;
  diagnosis: unknown;
  keywordExpansion: unknown;
  signals: {
    trends: unknown;
    tiktok: unknown[];
    youtube: unknown[];
    ads: unknown[];
  };
}): Promise<ProductIdeasResponse> {
  const result = await createStructuredResponse({
    model: deepOpenAIModel,
    schema: productIdeasSchema,
    schemaName: "product_ideas",
    instructions: [
      SPY_RESPONSE_STRATEGY_PROMPT,
      "Nesta tarefa, gere ideias estruturadas de produtos/ofertas digitais com foco em VSL, criativos, promessa, risco e primeiro teste. Retorne apenas JSON conforme o schema.",
    ].join("\n\n"),
    input: JSON.stringify({
      task: "Generate structured digital product and offer ideas from the collected market signals.",
      rules: [
        "Generate 3 to 5 product ideas.",
        "Use the search language.",
        "Base ideas on the available real signals and clearly account for weak, sparse, or fallback sources.",
        "Do not invent metrics.",
        "Do not promise guaranteed financial results.",
        "Do not create aggressive, sensitive, miraculous, or absolute claims.",
        "Prioritize simple MVP-friendly offers that are easy to explain and viable for VSL.",
        "Each idea must include a practical first test such as a creative, landing page, short VSL, or white ad.",
        "Use structure from real signals, not copied text from videos or ads.",
      ],
      input,
    }),
  });

  return normalizeProductIdeas(result);
}
