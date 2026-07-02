import { NextResponse } from "next/server";
import path from "node:path";
import { nanoid } from "nanoid";

import { personasRepo } from "@/lib/db";
import {
  PERSONAS_DIR,
  writeBuffer,
  toRelative,
  detectMime,
  extFromMime,
  resolveDataPath,
  deleteIfExists,
} from "@/lib/files";

export const dynamic = "force-dynamic";

interface Params {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/personas/[id]/refs?kind=face|style
 * Body: multipart/form-data com `file`
 *
 * - face: substitui face_path (e remove arquivo antigo)
 * - style: append em style_paths
 */
export async function POST(req: Request, { params }: Params) {
  const { id } = await params;
  const persona = personasRepo.get(id);
  if (!persona) {
    return NextResponse.json({ error: "Persona não encontrada" }, { status: 404 });
  }

  const { searchParams } = new URL(req.url);
  const kind = searchParams.get("kind");
  if (kind !== "face" && kind !== "style") {
    return NextResponse.json(
      { error: "Query 'kind' deve ser 'face' ou 'style'" },
      { status: 400 }
    );
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "Faltou o campo 'file' no form-data" },
      { status: 400 }
    );
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const mime = detectMime(buf);
  if (!mime.startsWith("image/")) {
    return NextResponse.json(
      { error: "Arquivo precisa ser PNG, JPG ou WebP" },
      { status: 400 }
    );
  }
  const ext = extFromMime(mime);

  const filename =
    kind === "face" ? `face.${ext}` : `style_${nanoid(6)}.${ext}`;
  const absPath = path.join(PERSONAS_DIR, id, filename);
  await writeBuffer(absPath, buf);

  const rel = toRelative(absPath);

  if (kind === "face") {
    if (persona.facePath && persona.facePath !== rel) {
      try {
        await deleteIfExists(resolveDataPath(persona.facePath));
      } catch {
        // ignore
      }
    }
    personasRepo.update(id, { facePath: rel });
  } else {
    personasRepo.update(id, { stylePaths: [...persona.stylePaths, rel] });
  }

  const updated = personasRepo.get(id);
  return NextResponse.json({ persona: updated, path: rel });
}

/**
 * DELETE /api/personas/[id]/refs?path=relative/path/to/file
 * Remove um style ref específico (ou face — limpa o slot).
 */
export async function DELETE(req: Request, { params }: Params) {
  const { id } = await params;
  const persona = personasRepo.get(id);
  if (!persona) {
    return NextResponse.json({ error: "Persona não encontrada" }, { status: 404 });
  }

  const { searchParams } = new URL(req.url);
  const target = searchParams.get("path");
  if (!target) {
    return NextResponse.json({ error: "Faltou ?path=" }, { status: 400 });
  }

  if (target === persona.facePath) {
    try {
      await deleteIfExists(resolveDataPath(target));
    } catch {}
    personasRepo.update(id, { facePath: "" });
  } else if (persona.stylePaths.includes(target)) {
    try {
      await deleteIfExists(resolveDataPath(target));
    } catch {}
    personasRepo.update(id, {
      stylePaths: persona.stylePaths.filter((p) => p !== target),
    });
  } else {
    return NextResponse.json({ error: "Ref não pertence a essa persona" }, { status: 404 });
  }

  return NextResponse.json({ persona: personasRepo.get(id) });
}
