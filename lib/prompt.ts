/**
 * Prompt builder com 2 modos:
 *  - from-scratch: usa o template clássico do THUMBNAIL_ASSISTANT.md
 *    (face direita, texto esquerda, fundo azul, setas vermelhas).
 *  - remodel: monta um prompt cirúrgico com text-swaps e object-swaps,
 *    deixando o anchor visual ditar layout/cores/composição.
 */
import type { TextSwap, ObjectSwap } from "./types";

// ─── Modo "From scratch" (sem competitor anchor) ──────────────────────

export interface FromScratchParams {
  headlineTop?: string | null;
  headlineMainWhite?: string | null;
  headlineMainYellow?: string | null;
  concept: string;
  extraInstructions?: string | null;
  hasCompetitorRef: boolean;
  hasPersona?: boolean;
}

export function buildFromScratchPrompt(p: FromScratchParams): string {
  // Modo "Gerar do zero": entrega o prompt do usuário **literal**, sem template.
  // Why: o usuário pediu controle total — qualquer instrução de layout/cor/texto
  // que injetávamos antes virava texto na imagem ou enviesava o resultado.
  // Único add-on permitido: nota técnica sobre face/style refs e referência
  // visual do competitor, porque essas imagens vão anexadas e o engine precisa
  // saber pra que servem.
  const lines: string[] = [];
  const hasPersona = p.hasPersona === true;

  lines.push(p.concept.trim());

  if (hasPersona) {
    lines.push("");
    lines.push(
      "Use the person from the attached face reference — match their face, hair and outfit. Do not invent a different person. Replicate their EXACT skin tone across all visible skin including the HANDS — never lighten or whiten it; hands must match the same skin color as the face."
    );
  }

  if (p.hasCompetitorRef) {
    lines.push("");
    lines.push(
      "Use the attached competitor thumbnail only as a visual mood reference; do not copy its text or composition literally."
    );
  }

  if (p.extraInstructions && p.extraInstructions.trim()) {
    lines.push("");
    lines.push(p.extraInstructions.trim());
  }

  return lines.join("\n");
}

// ─── Modo "Remodel" (com competitor anchor + swaps) ───────────────────

export interface RemodelParams {
  textSwaps: TextSwap[];
  objectSwaps: ObjectSwap[];
  compositionAnchor?: string | null;
  extraInstructions?: string | null;
  hasPersona?: boolean;
}

export function buildRemodelPrompt(p: RemodelParams): string {
  const lines: string[] = [];
  const hasPersona = p.hasPersona !== false; // default true

  lines.push(
    "YouTube thumbnail, 16:9, 1920x1080. You are REMODELING the thumbnail in the LAST attached reference image."
  );
  lines.push("");
  lines.push(
    "Preserve EXACTLY from the anchor reference: layout, color palette, gradient direction, font weight and treatment, banner shapes, arrows, warning triangles, drop shadows, overall composition and visual hierarchy."
  );
  if (hasPersona) {
    lines.push("");
    lines.push(
      "Replace the person/face shown in the anchor with the FIRST attached face reference — match that person's face, hair, outfit, expression EXACTLY. Keep them in the same position and scale as the original."
    );
    lines.push("");
    lines.push(
      "CRITICAL — SKIN TONE FIDELITY: replicate the EXACT skin color and tone of the attached face reference across ALL visible skin — face, neck, ears, arms and ESPECIALLY the HANDS. Every visible body part must share the same skin tone as the reference person. NEVER lighten, whiten, desaturate or otherwise alter the skin color. If the reference person has dark/Black skin, the hands and all skin must render in that same dark tone — the hands must NEVER come out lighter or a different color than the face."
    );
  }

  if (p.compositionAnchor) {
    lines.push("");
    lines.push(`Original composition: ${p.compositionAnchor}.`);
  }

  // Text swaps
  const activeTextSwaps = p.textSwaps.filter((s) => s.action !== "keep");
  const keptTextSwaps = p.textSwaps.filter((s) => s.action === "keep");
  if (activeTextSwaps.length > 0) {
    lines.push("");
    lines.push(
      "TEXT REPLACEMENTS — preserve original position, color, font style and size:"
    );
    for (const s of activeTextSwaps) {
      const where = s.position ? ` (${s.position})` : "";
      const style = s.style ? ` [${s.style}]` : "";
      if (s.action === "remove") {
        lines.push(`- REMOVE the original text "${s.original}"${where}${style}`);
      } else if (s.action === "replace" && s.replacement) {
        lines.push(
          `- Replace "${s.original}"${where}${style} → "${s.replacement}"`
        );
      }
    }
  }
  if (keptTextSwaps.length > 0) {
    lines.push("");
    lines.push(
      "Keep the following text exactly as in the anchor: " +
        keptTextSwaps.map((s) => `"${s.original}"`).join(", ")
    );
  }

  // Object swaps
  const activeObjSwaps = p.objectSwaps.filter((s) => s.action !== "keep");
  const keptObjSwaps = p.objectSwaps.filter((s) => s.action === "keep");
  if (activeObjSwaps.length > 0) {
    lines.push("");
    lines.push(
      "OBJECT/SCENE REPLACEMENTS — preserve original position, scale, lighting and visual treatment:"
    );
    for (const s of activeObjSwaps) {
      const where = s.position ? ` (${s.position})` : "";
      if (s.action === "remove") {
        lines.push(`- REMOVE the ${s.original}${where}`);
      } else if (s.action === "replace" && s.replacement) {
        lines.push(`- Replace ${s.original}${where} → ${s.replacement}`);
      }
    }
  }
  if (keptObjSwaps.length > 0) {
    lines.push("");
    lines.push(
      "Keep the following objects unchanged: " +
        keptObjSwaps.map((s) => s.original).join(", ")
    );
  }

  lines.push("");
  lines.push(
    "Result must read clearly at 320x180 on a phone. NO watermarks, NO logos, NO brand names, NO faces other than the attached face reference."
  );

  if (p.extraInstructions && p.extraInstructions.trim()) {
    lines.push("");
    lines.push(`Additional instructions: ${p.extraInstructions.trim()}`);
  }

  return lines.join("\n");
}

// ─── Façade compatível com chamadas existentes ────────────────────────

export interface ThumbnailPromptParams {
  headlineTop?: string | null;
  headlineMainWhite?: string | null;
  headlineMainYellow?: string | null;
  concept: string;
  extraInstructions?: string | null;
  hasCompetitorRef: boolean;
}

export function buildThumbnailPrompt(p: ThumbnailPromptParams): string {
  return buildFromScratchPrompt(p);
}
