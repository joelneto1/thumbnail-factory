import { NextResponse } from "next/server";
import path from "node:path";
import { nanoid } from "nanoid";

import {
  COMPETITORS_DIR,
  writeBuffer,
  toRelative,
  detectMime,
  extFromMime,
} from "@/lib/files";

export const dynamic = "force-dynamic";

/**
 * POST /api/competitors/upload — multipart/form-data com campo `file`
 * Salva em data/competitors/upload_{nanoid}.{ext} e retorna o relpath.
 */
export async function POST(req: Request) {
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "Faltou o campo 'file'" },
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
  const filename = `upload_${nanoid(8)}.${ext}`;
  const abs = path.join(COMPETITORS_DIR, filename);
  await writeBuffer(abs, buf);

  return NextResponse.json({ thumbRelPath: toRelative(abs) });
}
