import { NextResponse } from "next/server";

import { generationsRepo, variantsRepo, recomputeGenerationStatus } from "@/lib/db";
import { deleteIfExists, resolveDataPath } from "@/lib/files";
import { requireSession } from "@/lib/auth/guard";
import { logged } from "@/lib/route-logger";

export const dynamic = "force-dynamic";

interface Params {
  params: Promise<{ id: string }>;
}

export const DELETE = logged("variants", "DELETE /variants/[id]", async function (_req: Request, { params }: Params) {
  const denied = await requireSession();
  if (denied) return denied;

  const { id } = await params;
  const variant = variantsRepo.get(id);
  if (!variant) {
    return NextResponse.json({ error: "Variante não encontrada" }, { status: 404 });
  }

  if (variant.outputPath) {
    try {
      const abs = resolveDataPath(variant.outputPath);
      await deleteIfExists(abs);
    } catch {
      // arquivo pode estar fora do sandbox ou já removido — segue.
    }
  }

  variantsRepo.delete(id);

  // Se o batch ficou sem variantes, descarta a geração inteira; senão recalcula status.
  const remaining = variantsRepo.listForGeneration(variant.generationId);
  if (remaining.length === 0) {
    generationsRepo.delete(variant.generationId);
    return NextResponse.json({ ok: true, generationDeleted: true });
  }

  recomputeGenerationStatus(variant.generationId);
  return NextResponse.json({ ok: true, generationDeleted: false });
});
