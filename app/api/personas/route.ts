import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import path from "node:path";
import fs from "node:fs/promises";

import { personasRepo } from "@/lib/db";
import { PERSONAS_DIR } from "@/lib/files";
import { createPersonaSchema } from "@/lib/schema";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ personas: personasRepo.list() });
}

export async function POST(req: Request) {
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
}
