import { NextResponse } from "next/server";

import { logsRepo, type LogLevel } from "@/lib/db";
import { requireSession } from "@/lib/auth/guard";
import { logger } from "@/lib/logger";
import { logged } from "@/lib/route-logger";

export const dynamic = "force-dynamic";

const LEVELS = new Set<LogLevel>(["info", "warn", "error"]);
const MAX_LIMIT = 200;

export const GET = logged("logs", "GET /logs", async function (req: Request) {
  const denied = await requireSession();
  if (denied) return denied;

  const { searchParams } = new URL(req.url);

  const levelParam = searchParams.get("level");
  const level =
    levelParam && LEVELS.has(levelParam as LogLevel)
      ? (levelParam as LogLevel)
      : undefined;

  const rawLimit = Number(searchParams.get("limit"));
  const limit =
    Number.isFinite(rawLimit) && rawLimit > 0
      ? Math.min(rawLimit, MAX_LIMIT)
      : 100;

  const rawBefore = Number(searchParams.get("before"));
  const before = Number.isFinite(rawBefore) && rawBefore > 0 ? rawBefore : undefined;

  const entries = logsRepo.list({
    level,
    scope: searchParams.get("scope") || undefined,
    generationId: searchParams.get("generationId") || undefined,
    search: searchParams.get("q") || undefined,
    limit,
    before,
  });

  return NextResponse.json(
    {
      entries,
      counts: logsRepo.counts(),
      // Cursor para paginação: id da última linha desta página.
      nextCursor: entries.length === limit ? entries[entries.length - 1].id : null,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
});

export const DELETE = logged("logs", "DELETE /logs", async function () {
  const denied = await requireSession();
  if (denied) return denied;

  const { total } = logsRepo.counts();
  logsRepo.clear();
  // Registra a própria limpeza, senão o log some sem deixar rastro de quem
  // o apagou — que é justamente o tipo de buraco que uma trilha não pode ter.
  logger.warn("logs", `Trilha de logs limpa (${total} entradas apagadas)`);

  return NextResponse.json({ ok: true, deleted: total });
});
