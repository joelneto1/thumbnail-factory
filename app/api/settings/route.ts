import { NextResponse } from "next/server";
import { z } from "zod";

import { getSettingsStatus, setSetting, SETTING_KEYS } from "@/lib/settings";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ settings: getSettingsStatus() });
}

const updateSchema = z.object({
  glabsBaseUrl: z.string().optional(),
  glabsApiKey: z.string().optional(),
  cliProxyBaseUrl: z.string().optional(),
  cliProxyApiKey: z.string().optional(),
  cliProxyModel: z.string().optional(),
  cliProxyReasoningEffort: z.string().optional(),
});

export async function POST(req: Request) {
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

  return NextResponse.json({ settings: getSettingsStatus() });
}
