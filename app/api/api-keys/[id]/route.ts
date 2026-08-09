import { NextResponse } from "next/server";

import { apiKeysRepo } from "@/lib/db";
import { requireSession } from "@/lib/auth/guard";
import { logger } from "@/lib/logger";
import { logged } from "@/lib/route-logger";

export const dynamic = "force-dynamic";

interface Params {
  params: Promise<{ id: string }>;
}

/** Revoga a chave. Marcação, não exclusão — o rastro de uso é preservado. */
export const DELETE = logged(
  "api-keys",
  "DELETE /api-keys/[id]",
  async function (_req: Request, { params }: Params) {
    const denied = await requireSession();
    if (denied) return denied;

    const { id } = await params;
    const key = apiKeysRepo.get(id);
    if (!key) {
      return NextResponse.json({ error: "Chave não encontrada" }, { status: 404 });
    }
    if (key.revokedAt) {
      return NextResponse.json({ error: "Chave já estava revogada" }, { status: 409 });
    }

    apiKeysRepo.revoke(id);
    logger.warn("api-keys", `Chave revogada: "${key.name}" (${key.prefix}…)`, {
      detail: { id, nome: key.name, prefixo: key.prefix },
    });

    return NextResponse.json({ key: apiKeysRepo.get(id) });
  }
);
