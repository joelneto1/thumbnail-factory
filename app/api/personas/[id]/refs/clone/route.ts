import { NextResponse } from "next/server";
import path from "node:path";
import fs from "node:fs/promises";
import { nanoid } from "nanoid";

import { personasRepo } from "@/lib/db";
import {
  PERSONAS_DIR,
  resolveDataPath,
  detectMime,
  extFromMime,
  toRelative,
  writeBuffer,
} from "@/lib/files";

export const dynamic = "force-dynamic";

interface Params {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/personas/[id]/refs/clone
 * Body: { fromPath: string }   // caminho relativo a data/ (ex: output/abc/variant_0.png)
 *
 * Copia uma imagem que já existe em data/ para a pasta da persona como
 * uma nova style ref. Usado pra "Use as style ref" no workbench.
 */
export async function POST(req: Request, { params }: Params) {
  const { id } = await params;
  const persona = personasRepo.get(id);
  if (!persona) {
    return NextResponse.json({ error: "Persona não encontrada" }, { status: 404 });
  }

  const body = (await req.json().catch(() => null)) as { fromPath?: string } | null;
  const fromPath = body?.fromPath;
  if (!fromPath) {
    return NextResponse.json({ error: "Faltou fromPath" }, { status: 400 });
  }

  let absSrc: string;
  try {
    absSrc = resolveDataPath(fromPath);
  } catch {
    return NextResponse.json({ error: "Caminho inválido" }, { status: 400 });
  }

  let buf: Buffer;
  try {
    buf = await fs.readFile(absSrc);
  } catch {
    return NextResponse.json({ error: "Arquivo origem não existe" }, { status: 404 });
  }

  const mime = detectMime(buf);
  if (!mime.startsWith("image/")) {
    return NextResponse.json({ error: "Origem não é imagem" }, { status: 400 });
  }
  const ext = extFromMime(mime);

  const filename = `style_${nanoid(6)}.${ext}`;
  const absDst = path.join(PERSONAS_DIR, id, filename);
  await writeBuffer(absDst, buf);

  const rel = toRelative(absDst);
  personasRepo.update(id, {
    stylePaths: [...persona.stylePaths, rel],
  });

  return NextResponse.json({
    persona: personasRepo.get(id),
    addedPath: rel,
  });
}
