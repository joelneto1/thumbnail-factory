import { NextResponse } from "next/server";
import { nanoid } from "nanoid";

import { generateRequestSchema } from "@/lib/schema";
import { generationsRepo, personasRepo } from "@/lib/db";
import { buildFromScratchPrompt, buildRemodelPrompt } from "@/lib/prompt";
import {
  startGeneration,
  loadReferencesForGeneration,
} from "@/lib/engines/orchestrator";
import { requireSession } from "@/lib/auth/guard";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const denied = await requireSession();
  if (denied) return denied;

  const body = await req.json().catch(() => null);
  const parsed = generateRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Request inválido", issues: parsed.error.issues },
      { status: 400 }
    );
  }
  const data = parsed.data;

  // Engine "gpt-image-2" é placeholder — coming soon.
  if (data.engine === "gpt-image-2") {
    return NextResponse.json(
      { error: "GPT Image 2.0 ainda não está disponível. Em breve." },
      { status: 400 }
    );
  }

  // Persona é opcional. Se vier, valida a existência e a face.
  const personaId = data.personaId?.trim() || null;
  let persona = null;
  if (personaId) {
    persona = personasRepo.get(personaId);
    if (!persona) {
      return NextResponse.json({ error: "Persona não encontrada" }, { status: 404 });
    }
    if (!persona.facePath) {
      return NextResponse.json(
        { error: "Persona não tem face reference. Faça o upload antes." },
        { status: 400 }
      );
    }
  }

  const competitorPath = data.competitorPath?.trim() ?? null;
  const hasPersona = !!persona;
  const storedTitle = data.title?.trim() ? data.title.trim() : null;

  let promptFinal: string;
  let storedHeadlineTop: string | null = null;
  let storedHeadlineMainWhite: string | null = null;
  let storedHeadlineMainYellow: string | null = null;
  let storedConcept = "";
  let swaps: { textSwaps: typeof data.textSwaps; objectSwaps: typeof data.objectSwaps } | null = null;

  if (data.mode === "remodel") {
    if (!competitorPath) {
      return NextResponse.json(
        { error: "Modo remodelar exige competitor reference" },
        { status: 400 }
      );
    }
    const textSwaps = data.textSwaps ?? [];
    const objectSwaps = data.objectSwaps ?? [];
    promptFinal = buildRemodelPrompt({
      textSwaps,
      objectSwaps,
      compositionAnchor: data.compositionAnchor,
      extraInstructions: data.extraInstructions,
      hasPersona,
    });
    swaps = { textSwaps, objectSwaps };
    storedConcept =
      `[remodel] ${objectSwaps
        .filter((s) => s.action === "replace" && s.replacement)
        .map((s) => `${s.original} → ${s.replacement}`)
        .join("; ") || "sem swaps de objeto"}`.slice(0, 800);
  } else {
    if (!data.concept || !data.concept.trim()) {
      return NextResponse.json(
        { error: "Conceito visual é obrigatório no modo from-scratch" },
        { status: 400 }
      );
    }
    storedHeadlineTop = data.headlineTop ?? null;
    storedHeadlineMainWhite = data.headlineMainWhite ?? null;
    storedHeadlineMainYellow = data.headlineMainYellow ?? null;
    storedConcept = data.concept;
    promptFinal = buildFromScratchPrompt({
      headlineTop: storedHeadlineTop,
      headlineMainWhite: storedHeadlineMainWhite,
      headlineMainYellow: storedHeadlineMainYellow,
      concept: storedConcept,
      extraInstructions: data.extraInstructions ?? null,
      hasCompetitorRef: !!competitorPath,
      hasPersona,
    });
  }

  let referenceImages: string[];
  try {
    referenceImages = await loadReferencesForGeneration(
      persona?.id ?? null,
      competitorPath
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 400 }
    );
  }

  const id = nanoid(12);
  generationsRepo.create({
    id,
    personaId: persona?.id ?? null,
    title: storedTitle,
    headlineTop: storedHeadlineTop,
    headlineMainWhite: storedHeadlineMainWhite,
    headlineMainYellow: storedHeadlineMainYellow,
    concept: storedConcept,
    competitorUrl: data.competitorUrl ?? null,
    competitorPath,
    promptFinal,
    engineRequested: data.engine,
    variantCount: data.variantCount,
    mode: data.mode,
    swaps: swaps
      ? {
          textSwaps: swaps.textSwaps ?? [],
          objectSwaps: swaps.objectSwaps ?? [],
        }
      : null,
  });

  if (persona) personasRepo.touchLastUsed(persona.id);

  void startGeneration({
    generationId: id,
    prompt: promptFinal,
    referenceImages,
    variantCount: data.variantCount,
    engine: data.engine,
  });

  return NextResponse.json({ generationId: id }, { status: 202 });
}
