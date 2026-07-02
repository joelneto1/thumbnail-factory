import { NextResponse } from "next/server";
import fs from "node:fs/promises";

import { resolveDataPath, detectMime } from "@/lib/files";

export const dynamic = "force-dynamic";

interface Params {
  params: Promise<{ path: string[] }>;
}

export async function GET(_req: Request, { params }: Params) {
  const { path: parts } = await params;
  if (!parts || parts.length === 0) {
    return NextResponse.json({ error: "Caminho vazio" }, { status: 400 });
  }
  const rel = parts.join("/");
  let abs: string;
  try {
    abs = resolveDataPath(rel);
  } catch {
    return NextResponse.json({ error: "Caminho inválido" }, { status: 400 });
  }

  let buf: Buffer;
  try {
    buf = await fs.readFile(abs);
  } catch {
    return NextResponse.json({ error: "Arquivo não encontrado" }, { status: 404 });
  }

  const mime = detectMime(buf);
  return new NextResponse(buf as unknown as BodyInit, {
    headers: {
      "Content-Type": mime,
      "Cache-Control": "public, max-age=300, must-revalidate",
    },
  });
}
