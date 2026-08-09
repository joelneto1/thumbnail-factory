import { NextResponse } from "next/server";
import { fetchCompetitorFromUrl } from "@/lib/youtube";
import { requireSession } from "@/lib/auth/guard";
import { logged } from "@/lib/route-logger";

export const dynamic = "force-dynamic";

export const GET = logged("youtube", "GET /youtube", async function (req: Request) {
  const denied = await requireSession();
  if (denied) return denied;

  const { searchParams } = new URL(req.url);
  const url = searchParams.get("url");
  if (!url) {
    return NextResponse.json({ error: "Faltou ?url=" }, { status: 400 });
  }
  try {
    const result = await fetchCompetitorFromUrl(url);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 400 }
    );
  }
});
