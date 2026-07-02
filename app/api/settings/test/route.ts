import { NextResponse } from "next/server";

import { checkGlabsHealth } from "@/lib/engines/glabs";
import { isGeminiConfigured } from "@/lib/engines/gemini";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { getGeminiApiKey, getGlabsBaseUrl } from "@/lib/settings";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const engine = body?.engine as "glabs" | "gemini" | undefined;
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

  if (engine === "gemini") {
    if (!isGeminiConfigured()) {
      return NextResponse.json({
        ok: false,
        detail: "Chave Gemini não configurada",
      });
    }
    try {
      const start = Date.now();
      const client = new GoogleGenerativeAI(getGeminiApiKey()!);
      const model = client.getGenerativeModel({ model: "gemini-2.5-flash" });
      // Smallest possible call
      const r = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: "ping" }] }],
        generationConfig: { maxOutputTokens: 5 },
      });
      const latency = Date.now() - start;
      const text = r.response.text();
      return NextResponse.json({
        ok: true,
        detail: `Conectado (${latency}ms) — modelo respondeu "${text.trim().slice(0, 30)}"`,
        latency,
      });
    } catch (err) {
      return NextResponse.json({
        ok: false,
        detail:
          err instanceof Error
            ? err.message
            : "Erro desconhecido conectando ao Gemini",
      });
    }
  }

  return NextResponse.json({ error: "Engine desconhecida" }, { status: 400 });
}
