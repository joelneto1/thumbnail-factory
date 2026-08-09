import { NextResponse } from "next/server";
import { checkGlabsHealth } from "@/lib/engines/glabs";
import { isClaudeConfigured } from "@/lib/engines/claude";
import { getGlabsBaseUrl } from "@/lib/settings";
import { getSession } from "@/lib/auth/guard";
import type { HealthStatus } from "@/lib/types";
import { logged } from "@/lib/route-logger";

export const dynamic = "force-dynamic";

/**
 * Rota deliberadamente pública: é o healthcheck do Coolify, que bate aqui sem
 * cookie nenhum. Por isso o detalhe só sai para quem tem sessão — sem isso,
 * qualquer um na internet leria o hostname Tailscale em `glabsBaseUrl`.
 */
export const GET = logged("health", "GET /health", async function () {
  const session = await getSession();

  if (!session) {
    return NextResponse.json(
      { status: "ok" },
      { headers: { "Cache-Control": "no-store" } }
    );
  }

  const glabs = await checkGlabsHealth();
  const payload: HealthStatus = {
    glabs: glabs.ok ? "up" : "down",
    claude: isClaudeConfigured() ? "configured" : "missing",
    glabsBaseUrl: getGlabsBaseUrl(),
    checkedAt: Date.now(),
  };
  return NextResponse.json(payload, {
    headers: { "Cache-Control": "no-store" },
  });
});
