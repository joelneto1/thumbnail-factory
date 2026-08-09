import { NextResponse } from "next/server";
import { z } from "zod";

import { adaptTexts } from "@/lib/engines/claude-adapt";
import { requireSession } from "@/lib/auth/guard";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  targetLanguage: z.string().min(2).max(60),
  texts: z
    .array(
      z.object({
        original: z.string().min(1).max(300),
        position: z.string().max(80).optional(),
        style: z.string().max(80).optional(),
      })
    )
    .min(1)
    .max(20),
});

export async function POST(req: Request) {
  const denied = await requireSession();
  if (denied) return denied;

  const body = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Request inválido", issues: parsed.error.issues },
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
}
