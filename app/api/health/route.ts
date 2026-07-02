import { NextResponse } from "next/server";
import { checkGlabsHealth } from "@/lib/engines/glabs";
import { isClaudeConfigured } from "@/lib/engines/claude";
import { getGlabsBaseUrl } from "@/lib/settings";
import type { HealthStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
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
}
