import { NextResponse } from "next/server";

import { checkGlabsHealth } from "@/lib/engines/glabs";
import { callClaude, isClaudeConfigured } from "@/lib/engines/claude";
import { getGlabsBaseUrl, getCliProxyBaseUrl, getCliProxyModel } from "@/lib/settings";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const engine = body?.engine as "glabs" | "claude" | undefined;
  if (!engine) {
    return NextResponse.json({ error: "Faltou 'engine'" }, { status: 400 });
  }

  if (engine === "glabs") {
    const start = Date.now();
    const result = await checkGlabsHealth(5000);
    const latency = Date.now() - start;
    return NextResponse.json({
      ok: result.ok,
      detail: result.ok
        ? `Conectado em ${getGlabsBaseUrl()} (${latency}ms)`
        : `Sem resposta de ${getGlabsBaseUrl()} — Chrome aberto e extensão conectada?`,
      latency,
    });
  }

  if (engine === "claude") {
    if (!isClaudeConfigured()) {
      return NextResponse.json({
        ok: false,
        detail: "Chave do CLI Proxy não configurada",
      });
    }
    try {
      const start = Date.now();
      const text = await callClaude({
        user: "Responda apenas com a palavra: pong",
        reasoningEffort: "low",
        maxTokens: 20,
        maxRetries: 1,
        timeoutMs: 30_000,
      });
      const latency = Date.now() - start;
      return NextResponse.json({
        ok: true,
        detail: `Conectado (${latency}ms) — ${getCliProxyModel()} respondeu "${text
          .trim()
          .slice(0, 30)}" via ${getCliProxyBaseUrl()}`,
        latency,
      });
    } catch (err) {
      return NextResponse.json({
        ok: false,
        detail:
          err instanceof Error
            ? err.message
            : "Erro desconhecido conectando ao CLI Proxy",
      });
    }
  }

  return NextResponse.json({ error: "Engine desconhecida" }, { status: 400 });
}
