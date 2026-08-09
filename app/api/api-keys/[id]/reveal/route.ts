import { NextResponse } from "next/server";

import { apiKeysRepo } from "@/lib/db";
import { decryptApiKey, maskApiKey } from "@/lib/auth/api-key";
import { getPrincipal } from "@/lib/auth/guard";
import { logger } from "@/lib/logger";
import { logged } from "@/lib/route-logger";

export const dynamic = "force-dynamic";

interface Params {
  params: Promise<{ id: string }>;
}

/**
 * Devolve a chave em texto puro, para quem perdeu poder copiá-la de novo.
 *
 * EXIGE SESSÃO DO NAVEGADOR — de propósito, não aceita X-API-Key. Sem essa
 * restrição, uma chave vazada poderia colher todas as outras, transformando um
 * comprometimento em comprometimento total.
 */
export const GET = logged(
  "api-keys",
  "GET /api-keys/[id]/reveal",
  async function (_req: Request, { params }: Params) {
    const principal = await getPrincipal();

    if (!principal) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }
    if (principal.kind !== "session") {
      logger.warn(
        "api-keys",
        `Tentativa de revelar chave usando outra chave de API ("${principal.keyName}") — negada`,
        { detail: { chaveUsada: principal.keyName } }
      );
      return NextResponse.json(
        {
          error:
            "Revelar uma chave exige sessão do navegador. Entre no sistema e copie pela aba API.",
        },
        { status: 403 }
      );
    }

    const { id } = await params;
    const key = apiKeysRepo.get(id);
    if (!key) {
      return NextResponse.json({ error: "Chave não encontrada" }, { status: 404 });
    }

    const plaintext = decryptApiKey(apiKeysRepo.getCipher(id));
    if (!plaintext) {
      return NextResponse.json(
        {
          error:
            "Esta chave não pode ser recuperada. Ou foi criada antes deste recurso existir, ou o AUTH_SECRET do servidor mudou desde então. Gere uma nova e revogue esta.",
        },
        { status: 410 }
      );
    }

    logger.info("api-keys", `Chave revelada: "${key.name}" (${key.prefix}…)`, {
      detail: { id, nome: key.name, por: principal.user },
    });

    return NextResponse.json(
      { plaintext, masked: maskApiKey(plaintext) },
      { headers: { "Cache-Control": "no-store" } }
    );
  }
);
