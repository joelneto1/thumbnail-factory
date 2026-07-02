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
  geminiApiKey: z.string().optional(),
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
  if (parsed.data.geminiApiKey !== undefined) {
    setSetting(SETTING_KEYS.GEMINI_API_KEY, parsed.data.geminiApiKey.trim());
  }

  return NextResponse.json({ settings: getSettingsStatus() });
}
