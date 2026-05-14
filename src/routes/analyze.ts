import { Router } from "express";
import { z } from "zod";
import { authMiddleware } from "../middleware/auth.js";
import { HttpError } from "../types.js";

const analyzeSchema = z.object({
  contentId: z.string().trim().min(1),
  source: z.string().trim().min(1),
});

export const analyzeRouter = Router();

analyzeRouter.post("/analyze/content", authMiddleware, (req, res, next) => {
  try {
    const parsedBody = analyzeSchema.safeParse(req.body);

    if (!parsedBody.success) {
      throw new HttpError(400, "Invalid request body", parsedBody.error.flatten());
    }

    res.json({
      hook: "Comeca com uma dor concreta e mostra um resultado visual rapido.",
      promise: "Transformar uma habilidade simples em uma oportunidade pratica de renda.",
      pain: "A audiencia quer vender, mas nao sabe por onde comecar nem como se diferenciar.",
      audience: "Iniciantes que buscam renda extra com baixo investimento inicial.",
      whyItWorked:
        "O conteudo combina prova visual, simplicidade e uma promessa especifica sem depender de autoridade previa.",
      adaptAd:
        "Abrir com uma cena real de bastidor, mostrar o resultado final e fechar com uma chamada direta para aprender o metodo.",
      adaptVsl:
        "Usar uma narrativa de antes e depois, apresentar o erro comum do iniciante e demonstrar o passo a passo.",
      adaptUgc:
        "Gravar em primeira pessoa, com linguagem casual, mostrando materiais, processo e resultado em cortes curtos.",
    });
  } catch (error) {
    next(error);
  }
});
