import { NextResponse } from "next/server";

import { generationsRepo, variantsRepo, personasRepo } from "@/lib/db";
import { pollPendingVariants } from "@/lib/engines/orchestrator";
import { requireSession } from "@/lib/auth/guard";
import { logged } from "@/lib/route-logger";

export const dynamic = "force-dynamic";

interface Params {
  params: Promise<{ id: string }>;
}

export const GET = logged("status", "GET /status/[id]", async function (_req: Request, { params }: Params) {
  const denied = await requireSession();
  if (denied) return denied;

  const { id } = await params;
  const generation = generationsRepo.get(id);
  if (!generation) {
    return NextResponse.json({ error: "Geração não encontrada" }, { status: 404 });
  }

  // Polling server-side antes de responder — atualiza variants pending/running
  await pollPendingVariants(id);

  const fresh = generationsRepo.get(id)!;
  const variants = variantsRepo.listForGeneration(id);
  const persona = fresh.personaId ? personasRepo.get(fresh.personaId) : null;

  return NextResponse.json({
    generation: fresh,
    variants,
    persona,
  });
});

export const DELETE = logged("status", "DELETE /status/[id]", async function (_req: Request, { params }: Params) {
  const denied = await requireSession();
  if (denied) return denied;

  const { id } = await params;
  const generation = generationsRepo.get(id);
  if (!generation) {
    return NextResponse.json({ error: "Geração não encontrada" }, { status: 404 });
  }
  generationsRepo.delete(id);
  return NextResponse.json({ ok: true });
});
