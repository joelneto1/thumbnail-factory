import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import path from "node:path";
import fs from "node:fs/promises";

import { personasRepo } from "@/lib/db";
import { PERSONAS_DIR } from "@/lib/files";
import { createPersonaSchema } from "@/lib/schema";
import { requireSession } from "@/lib/auth/guard";
import { logged } from "@/lib/route-logger";

export const dynamic = "force-dynamic";

export const GET = logged("personas", "GET /personas", async function () {
  const denied = await requireSession();
  if (denied) return denied;

  return NextResponse.json({ personas: personasRepo.list() });
});

export const POST = logged("personas", "POST /personas", async function (req: Request) {
  const denied = await requireSession();
  if (denied) return denied;

  const body = await req.json().catch(() => null);
  const parsed = createPersonaSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados inválidos", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const id = nanoid(10);
  const personaDir = path.join(PERSONAS_DIR, id);
  await fs.mkdir(personaDir, { recursive: true });

  // Cria com facePath placeholder vazio — o usuário precisa fazer upload
  // depois via POST /api/personas/[id]/refs?kind=face
  const persona = personasRepo.create({
    id,
    name: parsed.data.name,
    channel: parsed.data.channel,
    notes: parsed.data.notes,
    facePath: "",
    stylePaths: [],
  });

  return NextResponse.json({ persona }, { status: 201 });
});
