import { NextResponse } from "next/server";
import { z } from "zod";

import { adaptTexts } from "@/lib/engines/claude-adapt";
import { requireSession } from "@/lib/auth/guard";
import { logger } from "@/lib/logger";
import { logged } from "@/lib/route-logger";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  targetLanguage: z.string().min(2).max(60),
  texts: z
    .array(
      z.object({
        // 600 e não 300: a análise às vezes devolve um parágrafo inteiro num
        // bloco só (uma thumb no estilo "história" passa de 380 caracteres), e
        // um limite apertado transformava isso num 400 sem explicação.
        original: z.string().min(1).max(600),
        position: z.string().max(80).optional(),
        style: z.string().max(80).optional(),
      })
    )
    .min(1)
    .max(30),
});

export const POST = logged("adapt-text", "POST /adapt-text", async function (req: Request) {
  const denied = await requireSession();
  if (denied) return denied;

  const body = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    // "Request inválido" sozinho não diz nada a quem está na tela. O caso real
    // foi um texto longo demais, e a mensagem genérica mandou procurar em todo
    // lugar menos no tamanho.
    const detail = parsed.error.issues
      .map((i) => `${i.path.join(".") || "corpo"}: ${i.message}`)
      .join("; ");
    logger.warn("adapt", `Requisição de adaptação rejeitada: ${detail}`, {
      detail: { issues: parsed.error.issues },
    });
    return NextResponse.json(
      { error: `Não foi possível adaptar — ${detail}`, issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const { texts, targetLanguage } = parsed.data;

  try {
    const adaptations = await adaptTexts(texts, targetLanguage);
    logger.info(
      "adapt",
      `${texts.length} texto(s) adaptado(s) para ${targetLanguage}`,
      {
        detail: {
          idioma: targetLanguage,
          // Guarda o antes/depois: é o que permite avaliar a qualidade da
          // adaptação depois, sem ter que reproduzir a geração.
          textos: adaptations.map((a) => `${a.original} → ${a.adapted}`),
        },
      }
    );
    return NextResponse.json(
      { adaptations },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error("adapt", `Falha ao adaptar para ${targetLanguage}: ${msg}`, {
      detail: { idioma: targetLanguage, quantidade: texts.length, erro: err },
    });
    return NextResponse.json({ error: msg }, { status: 502 });
  }
});
