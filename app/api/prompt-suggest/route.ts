import { NextResponse } from "next/server";
import { z } from "zod";

import { suggestPrompt } from "@/lib/engines/claude-text";
import { requireSession } from "@/lib/auth/guard";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const schema = z.object({
  draft: z.string().max(2000).optional(),
  personaName: z.string().max(120).optional(),
  language: z.enum(["pt-BR", "en"]).optional(),
});

export async function POST(req: Request) {
  const denied = await requireSession();
  if (denied) return denied;

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body ?? {});
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Request inválido", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  try {
    const suggestion = await suggestPrompt({
      draft: parsed.data.draft,
      personaName: parsed.data.personaName,
      language: parsed.data.language ?? "pt-BR",
    });
    return NextResponse.json({ suggestion });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Falha no Prompt Assist" },
      { status: 502 }
    );
  }
}
