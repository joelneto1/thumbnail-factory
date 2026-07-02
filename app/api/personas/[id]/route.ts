import { NextResponse } from "next/server";
import path from "node:path";

import { personasRepo } from "@/lib/db";
import { PERSONAS_DIR, deleteIfExists } from "@/lib/files";
import { updatePersonaSchema } from "@/lib/schema";

export const dynamic = "force-dynamic";

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;
  const persona = personasRepo.get(id);
  if (!persona) {
    return NextResponse.json({ error: "Persona não encontrada" }, { status: 404 });
  }
  return NextResponse.json({ persona });
}

export async function PATCH(req: Request, { params }: Params) {
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = updatePersonaSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados inválidos", issues: parsed.error.issues },
      { status: 400 }
    );
  }
  const updated = personasRepo.update(id, parsed.data);
  if (!updated) {
    return NextResponse.json({ error: "Persona não encontrada" }, { status: 404 });
  }
  return NextResponse.json({ persona: updated });
}

export async function DELETE(_req: Request, { params }: Params) {
  const { id } = await params;
  const persona = personasRepo.get(id);
  if (!persona) {
    return NextResponse.json({ error: "Persona não encontrada" }, { status: 404 });
  }
  personasRepo.delete(id);
  await deleteIfExists(path.join(PERSONAS_DIR, id));
  return NextResponse.json({ ok: true });
}
