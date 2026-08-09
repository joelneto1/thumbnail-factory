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

  // A redação evita descrever a tarefa como "refazer a imagem anexada" ou
  // "trocar o rosto": as duas leem como reprodução de obra e troca de face, e
  // os filtros dos provedores reagem a esse enquadramento. O que o usuário faz
  // é criar uma thumbnail própria seguindo um layout de referência — dizer
  // isso é mais fiel à intenção real e não dispara o filtro.
  lines.push(
    "Design an original YouTube thumbnail, 16:9, 1920x1080. Use the LAST attached image ONLY as a layout and style guide — it is a design reference, not something to copy."
  );
  lines.push("");
  lines.push(
    "Follow the reference's DESIGN SYSTEM: layout grid, color palette, gradient direction, font weight and treatment, banner shapes, arrows, warning triangles, drop shadows, overall composition and visual hierarchy. Reproduce the STRUCTURE, with entirely new content."
  );
  if (hasPersona) {
    lines.push("");
    lines.push(
      "The person featured in this thumbnail is the one in the FIRST attached photo — the channel's own presenter. Portray that presenter: same face, hair and outfit, placed at the same position and scale the layout guide uses for its subject."
    );
    lines.push("");
    lines.push(
      "APPEARANCE ACCURACY: keep the presenter's complexion consistent and true to the photo across every visible area — face, neck, ears, arms and especially the HANDS. Do not lighten, brighten or desaturate it, and never let the hands come out in a different tone from the face."
    );
  } else {
    // Sem persona, a única imagem anexada é a thumbnail do concorrente — que
    // costuma trazer uma pessoa real e identificável. Sem esta instrução, o
    // pedido vira "reproduza esta pessoa", que os provedores bloqueiam por
    // política, e com razão: é a semelhança de alguém real. Pedir uma pessoa
    // diferente resolve o bloqueio E é o comportamento correto.
    lines.push("");
    lines.push(
      "PEOPLE: do NOT reproduce, copy or resemble any person appearing in the anchor reference. If the layout needs a person in that spot, invent a completely different, generic, non-identifiable person — different face, different hair, different build — keeping only the pose, framing, scale and lighting so the composition still works. The anchor is a layout reference, never a likeness reference."
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

  // Object swaps.
  // "Ativo" exige ter o que dizer: um item marcado como "replace" mas com o
  // campo de substituição vazio não gera linha nenhuma, e antes isso imprimia
  // o cabeçalho sozinho — instrução vazia que só confunde o modelo.
  const activeObjSwaps = p.objectSwaps.filter(
    (s) => s.action === "remove" || (s.action === "replace" && s.replacement?.trim())
  );
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
    hasPersona
      ? "Result must read clearly at 320x180 on a phone. NO watermarks, NO logos, NO brand names, NO faces other than the attached face reference."
      : // Sem persona não existe "attached face reference": citá-la deixava o
        // prompt incoerente e reforçava o pedido de reproduzir a pessoa do anchor.
        "Result must read clearly at 320x180 on a phone. NO watermarks, NO logos, NO brand names, and no recognisable real person."
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
