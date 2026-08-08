import { NextResponse } from "next/server";
import { z } from "zod";

import { analyzeImage } from "@/lib/engines/claude-analyze";
import { resolveDataPath, readImageAsDataUrl } from "@/lib/files";
import { requireSession } from "@/lib/auth/guard";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const schema = z.object({
  imagePath: z.string().min(1),
});

export async function POST(req: Request) {
  const denied = await requireSession();
  if (denied) return denied;

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "imagePath obrigatório" },
      { status: 400 }
    );
  }

  let dataUrl: string;
  try {
    dataUrl = await readImageAsDataUrl(resolveDataPath(parsed.data.imagePath));
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Imagem não encontrada" },
      { status: 404 }
    );
  }

  try {
    const analysis = await analyzeImage(dataUrl);
    return NextResponse.json({ analysis });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Falha na análise" },
      { status: 502 }
    );
  }
}
