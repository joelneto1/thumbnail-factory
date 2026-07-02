import { NextResponse } from "next/server";

import { generationsRepo, variantsRepo, personasRepo } from "@/lib/db";
import { pollPendingVariants } from "@/lib/engines/orchestrator";

export const dynamic = "force-dynamic";

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(_req: Request, { params }: Params) {
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
}

export async function DELETE(_req: Request, { params }: Params) {
  const { id } = await params;
  const generation = generationsRepo.get(id);
  if (!generation) {
    return NextResponse.json({ error: "Geração não encontrada" }, { status: 404 });
  }
  generationsRepo.delete(id);
  return NextResponse.json({ ok: true });
}
