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
import { requireSession } from "@/lib/auth/guard";
import { logger } from "@/lib/logger";
import { logged } from "@/lib/route-logger";

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
export const POST = logged("personas", "POST /personas/[id]/refs", async function (req: Request, { params }: Params) {
  const denied = await requireSession();
  if (denied) return denied;

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

  // O tamanho declarado é lido ANTES de tentar parsear: quando o corpo passa do
  // limite bufferizado pelo proxy, ele chega truncado e o formData() só acusa
  // "faltou o campo file" — mensagem que manda procurar no lugar errado.
  const declaredSize = Number(req.headers.get("content-length") ?? 0);

  const form = await req.formData().catch((err) => {
    logger.error("upload", `form-data ilegível (persona ${id})`, {
      detail: { kind, contentLength: declaredSize, erro: err },
    });
    return null;
  });
  const file = form?.get("file");
  if (!(file instanceof File)) {
    const mb = (declaredSize / 1048576).toFixed(1);
    const suspeitaTamanho = declaredSize > 10 * 1048576;
    const msg = suspeitaTamanho
      ? `A imagem (${mb} MB) não chegou inteira ao servidor. Use um arquivo menor ou reduza a resolução.`
      : "Faltou o campo 'file' no form-data";
    logger.error("upload", `Upload de ${kind} falhou (persona ${id}): ${msg}`, {
      detail: { kind, personaId: id, contentLength: declaredSize, mb },
    });
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const mime = detectMime(buf);
  if (!mime.startsWith("image/")) {
    logger.warn("upload", `Arquivo rejeitado (não é imagem): ${mime}`, {
      detail: { kind, personaId: id, mime, bytes: buf.length },
    });
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
});

/**
 * DELETE /api/personas/[id]/refs?path=relative/path/to/file
 * Remove um style ref específico (ou face — limpa o slot).
 */
export const DELETE = logged("personas", "DELETE /personas/[id]/refs", async function (req: Request, { params }: Params) {
  const denied = await requireSession();
  if (denied) return denied;

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
});
