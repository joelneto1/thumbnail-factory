import { NextResponse } from "next/server";

import { generationsRepo, variantsRepo, personasRepo } from "@/lib/db";
import { requireSession } from "@/lib/auth/guard";
import { logged } from "@/lib/route-logger";

export const dynamic = "force-dynamic";

export const GET = logged("history", "GET /history", async function (req: Request) {
  const denied = await requireSession();
  if (denied) return denied;

  const { searchParams } = new URL(req.url);
  const personaId = searchParams.get("personaId") ?? undefined;
  const cursorRaw = searchParams.get("cursor");
  const cursor = cursorRaw ? Number(cursorRaw) : undefined;
  const limit = Number(searchParams.get("limit") ?? 30);

  const generations = generationsRepo.list({ personaId, cursor, limit });

  const enriched = generations.map((g) => {
    const variants = variantsRepo.listForGeneration(g.id);
    const persona = g.personaId ? personasRepo.get(g.personaId) : null;
    const firstCompleted =
      variants.find((v) => v.status === "completed") ?? null;
    return {
      generation: g,
      persona: persona
        ? { id: persona.id, name: persona.name, channel: persona.channel }
        : null,
      thumbnail: firstCompleted?.outputPath ?? null,
      variantCount: variants.length,
      completedCount: variants.filter((v) => v.status === "completed").length,
    };
  });

  const nextCursor =
    generations.length === limit
      ? generations[generations.length - 1].createdAt
      : null;

  return NextResponse.json({ items: enriched, nextCursor });
});
