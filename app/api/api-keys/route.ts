import { NextResponse } from "next/server";
import { z } from "zod";
import { nanoid } from "nanoid";

import { apiKeysRepo } from "@/lib/db";
import { generateApiKey } from "@/lib/auth/api-key";
import { requireSession, getPrincipal } from "@/lib/auth/guard";
import { logger } from "@/lib/logger";
import { logged } from "@/lib/route-logger";

export const dynamic = "force-dynamic";

export const GET = logged("api-keys", "GET /api-keys", async function () {
  const denied = await requireSession();
  if (denied) return denied;

  return NextResponse.json(
    { keys: apiKeysRepo.list() },
    { headers: { "Cache-Control": "no-store" } }
  );
});

const createSchema = z.object({
  name: z.string().min(1).max(60),
});

export const POST = logged("api-keys", "POST /api-keys", async function (req: Request) {
  const denied = await requireSession();
  if (denied) return denied;

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dê um nome à chave (1 a 60 caracteres) para identificar o sistema." },
      { status: 400 }
    );
  }

  const { plaintext, hash, prefix } = generateApiKey();
  const key = apiKeysRepo.create({
    id: nanoid(12),
    name: parsed.data.name.trim(),
    prefix,
    keyHash: hash,
  });

  const principal = await getPrincipal();
  logger.info("api-keys", `Chave de API criada: "${key.name}" (${prefix}…)`, {
    detail: {
      id: key.id,
      nome: key.name,
      prefixo: prefix,
      criadaPor: principal?.kind === "apiKey" ? `chave ${principal.keyName}` : "sessão",
    },
  });

  // `plaintext` só existe nesta resposta. Não há endpoint que o recupere.
  return NextResponse.json({ key, plaintext }, { status: 201 });
});
