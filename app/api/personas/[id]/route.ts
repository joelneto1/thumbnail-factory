import { NextResponse } from "next/server";
import path from "node:path";

import { personasRepo } from "@/lib/db";
import { PERSONAS_DIR, deleteIfExists } from "@/lib/files";
import { updatePersonaSchema } from "@/lib/schema";
import { requireSession } from "@/lib/auth/guard";
import { logged } from "@/lib/route-logger";

export const dynamic = "force-dynamic";

interface Params {
  params: Promise<{ id: string }>;
}

export const GET = logged("personas", "GET /personas/[id]", async function (_req: Request, { params }: Params) {
  const denied = await requireSession();
  if (denied) return denied;

  const { id } = await params;
  const persona = personasRepo.get(id);
  if (!persona) {
    return NextResponse.json({ error: "Persona não encontrada" }, { status: 404 });
  }
  return NextResponse.json({ persona });
});

export const PATCH = logged("personas", "PATCH /personas/[id]", async function (req: Request, { params }: Params) {
  const denied = await requireSession();
  if (denied) return denied;

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
});

export const DELETE = logged("personas", "DELETE /personas/[id]", async function (_req: Request, { params }: Params) {
  const denied = await requireSession();
  if (denied) return denied;

  const { id } = await params;
  const persona = personasRepo.get(id);
  if (!persona) {
    return NextResponse.json({ error: "Persona não encontrada" }, { status: 404 });
  }
  personasRepo.delete(id);
  await deleteIfExists(path.join(PERSONAS_DIR, id));
  return NextResponse.json({ ok: true });
});
