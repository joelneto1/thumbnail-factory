import { NextResponse } from "next/server";
import { z } from "zod";

import { getSettingsStatus, setSetting, SETTING_KEYS } from "@/lib/settings";
import { requireSession } from "@/lib/auth/guard";
import { logger } from "@/lib/logger";
import { logged } from "@/lib/route-logger";

export const dynamic = "force-dynamic";

export const GET = logged("settings", "GET /settings", async function () {
  const denied = await requireSession();
  if (denied) return denied;

  return NextResponse.json({ settings: getSettingsStatus() });
});

const updateSchema = z.object({
  glabsBaseUrl: z.string().optional(),
  glabsApiKey: z.string().optional(),
  cliProxyBaseUrl: z.string().optional(),
  cliProxyApiKey: z.string().optional(),
  cliProxyModel: z.string().optional(),
  cliProxyReasoningEffort: z.string().optional(),
});

export const POST = logged("settings", "POST /settings", async function (req: Request) {
  const denied = await requireSession();
  if (denied) return denied;

  const body = await req.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados inválidos", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  if (parsed.data.glabsBaseUrl !== undefined) {
    setSetting(SETTING_KEYS.GLABS_BASE_URL, parsed.data.glabsBaseUrl.trim());
  }
  if (parsed.data.glabsApiKey !== undefined) {
    setSetting(SETTING_KEYS.GLABS_API_KEY, parsed.data.glabsApiKey.trim());
  }
  if (parsed.data.cliProxyBaseUrl !== undefined) {
    setSetting(SETTING_KEYS.CLI_PROXY_BASE_URL, parsed.data.cliProxyBaseUrl.trim());
  }
  if (parsed.data.cliProxyApiKey !== undefined) {
    setSetting(SETTING_KEYS.CLI_PROXY_API_KEY, parsed.data.cliProxyApiKey.trim());
  }
  if (parsed.data.cliProxyModel !== undefined) {
    setSetting(SETTING_KEYS.CLI_PROXY_MODEL, parsed.data.cliProxyModel.trim());
  }
  if (parsed.data.cliProxyReasoningEffort !== undefined) {
    setSetting(
      SETTING_KEYS.CLI_PROXY_REASONING_EFFORT,
      parsed.data.cliProxyReasoningEffort.trim()
    );
  }

  // Registra QUAIS chaves mudaram, nunca os valores — duas delas são segredo.
  const alteradas = Object.keys(parsed.data).filter(
    (k) => parsed.data[k as keyof typeof parsed.data] !== undefined
  );
  if (alteradas.length) {
    logger.info("settings", `Settings alteradas: ${alteradas.join(", ")}`, {
      detail: { chaves: alteradas },
    });
  }

  return NextResponse.json({ settings: getSettingsStatus() });
});
