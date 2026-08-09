/**
 * Orquestra a geração de variantes no G-Labs:
 *   - dispara N tasks paralelas
 *   - mantém o DB atualizado (variant.task_id, status, output_path, error_detail)
 *   - garante que `recomputeGenerationStatus` seja chamado após cada update
 *
 * Duas engines de imagem, ambas atrás do G-Labs (mesmo host, mesma API key):
 *   - "glabs"       → POST /api/image/generate  (Nano Banana Pro)
 *   - "gpt-image-2" → POST /api/openai/generate (OpenAI GPT Image 2)
 *
 * Não há fallback entre elas: se a engine escolhida falhar, a variante falha.
 * O Claude cobre texto/análise, mas NÃO gera imagem. (RunPod/FLUX.2 entra como
 * terceiro provider numa fase futura.)
 *
 * O polling é comum às duas — o G-Labs usa o mesmo /api/status/{task_id}.
 */
import path from "node:path";
import { nanoid } from "nanoid";

import {
  variantsRepo,
  recomputeGenerationStatus,
  personasRepo,
} from "../db";
import {
  OUTPUT_DIR,
  PERSONAS_DIR,
  resolveDataPath,
  readImageAsDataUrl,
  writeBuffer,
  toRelative,
} from "../files";
import * as glabs from "./glabs";
import type { EngineId, GenerationVariant } from "../types";

interface DispatchContext {
  generationId: string;
  prompt: string;
  referenceImages: string[]; // data URLs já em memória
  variantCount: number;
  engine: EngineId;
}

/**
 * Cria as N rows de variant e dispara as gerações em paralelo (sem await
 * — fire-and-forget; o cliente faz polling de /api/status/{id}).
 */
export async function startGeneration(ctx: DispatchContext): Promise<void> {
  const variants: GenerationVariant[] = [];
  for (let i = 0; i < ctx.variantCount; i++) {
    const v = variantsRepo.create({
      id: nanoid(12),
      generationId: ctx.generationId,
      variantIndex: i,
      engineUsed: ctx.engine,
    });
    variants.push(v);
  }

  // Disparar em paralelo. Erros individuais não matam outras variantes.
  for (const v of variants) {
    void dispatchVariant(v.id, ctx.prompt, ctx.referenceImages, ctx.engine).catch((err) => {
      console.error(`[orchestrator] variant ${v.id} crashed:`, err);
      variantsRepo.setFailed(
        v.id,
        err instanceof Error ? err.message : String(err)
      );
      recomputeGenerationStatus(ctx.generationId);
    });
  }
}

async function dispatchVariant(
  variantId: string,
  prompt: string,
  referenceImages: string[],
  engine: EngineId
): Promise<void> {
  try {
    const taskId =
      engine === "gpt-image-2"
        ? await glabs.submitGptImage({
            prompt,
            referenceImages,
            aspectRatio: "16:9",
          })
        : await glabs.submitImage({
            prompt,
            referenceImages,
            aspectRatio: "16:9",
            model: "nano_banana_pro",
          });
    variantsRepo.setTaskId(variantId, taskId, engine);
  } catch (err) {
    const variant = variantsRepo.get(variantId);
    variantsRepo.setFailed(
      variantId,
      err instanceof Error ? err.message : String(err)
    );
    if (variant) recomputeGenerationStatus(variant.generationId);
  }
}

/** Engines que expõem task_id no /api/status do G-Labs. "gemini" é legado. */
const POLLABLE: ReadonlySet<EngineId> = new Set<EngineId>(["glabs", "gpt-image-2"]);

/**
 * Polling server-side para variantes em pending/running.
 * Chamado por GET /api/status/[id] sempre que o cliente pinga.
 *
 * Para cada variant:
 *   - consulta /api/status/{task_id}
 *   - se completed → baixa, salva, marca completed
 *   - se failed → marca failed (com detalhe)
 *   - se pending/running → não faz nada
 */
export async function pollPendingVariants(generationId: string): Promise<void> {
  const variants = variantsRepo.listForGeneration(generationId);
  const work: Promise<void>[] = [];

  for (const v of variants) {
    if (v.status !== "pending" && v.status !== "running") continue;
    if (!POLLABLE.has(v.engineUsed)) continue;
    if (!v.taskId) continue;

    work.push(pollOne(v));
  }

  if (work.length) {
    await Promise.allSettled(work);
    recomputeGenerationStatus(generationId);
  }
}

async function pollOne(v: GenerationVariant): Promise<void> {
  try {
    const status = await glabs.getStatus(v.taskId!);
    if (status.status === "completed") {
      const result = status.results?.[0];
      if (!result) {
        variantsRepo.setFailed(v.id, "G-Labs reportou completed sem results");
        return;
      }
      const { buffer, filename } = await glabs.downloadResult(result);
      const ext = path.extname(filename) || ".png";
      const outAbs = path.join(
        OUTPUT_DIR,
        v.generationId,
        `variant_${v.variantIndex}${ext}`
      );
      await writeBuffer(outAbs, buffer);
      variantsRepo.setCompleted(v.id, toRelative(outAbs));
    } else if (status.status === "failed") {
      const rawDetail =
        status.error_detail ??
        status.error ??
        `error_code=${status.error_code ?? "?"}`;

      // As duas engines repassam só "No images generated" quando o provedor
      // bloqueia por política de conteúdo, sem dizer o motivo. Detectamos esse
      // padrão e acrescentamos o contexto de quem bloqueou.
      const looksGeneric =
        /no images? generated|empty result|no result|failed to generate|nothing returned/i.test(
          rawDetail
        );
      const culprit =
        v.engineUsed === "gpt-image-2"
          ? "provável violação de política de conteúdo da OpenAI (o prompt ou a imagem do concorrente foi vetado). Tente outro competitor, reformule, ou gere pelo G-Labs."
          : "provável violação de política de conteúdo no labs.google (a imagem do concorrente ou o prompt foi vetado pela Google). Tente outro competitor ou reformule.";
      const detail = looksGeneric ? `${rawDetail} — ${culprit}` : rawDetail;

      variantsRepo.setFailed(v.id, detail);
    }
    // pending/running → mantém
  } catch (err) {
    // Erro de rede no polling (G-Labs caiu) → falha a variante.
    variantsRepo.setFailed(
      v.id,
      err instanceof Error ? err.message : String(err)
    );
  }
}

/** Referências separadas por papel, para o corte saber o que pode descartar. */
export interface ReferenceSet {
  face: string | null;
  styles: string[];
  competitor: string | null;
}

/**
 * Helper público: carrega face + styles + competitor (se houver) como data URLs.
 *
 * Se personaId for null/undefined, pula face/styles — usado quando o
 * usuário gera "do absoluto zero" sem fixar uma persona.
 */
export async function loadReferencesForGeneration(
  personaId: string | null | undefined,
  competitorRelPath: string | null
): Promise<ReferenceSet> {
  const set: ReferenceSet = { face: null, styles: [], competitor: null };

  if (personaId) {
    const persona = personasRepo.get(personaId);
    if (!persona) throw new Error(`Persona ${personaId} não existe`);
    if (persona.facePath) {
      set.face = await readImageAsDataUrl(resolveDataPath(persona.facePath));
    }
    for (const styleRel of persona.stylePaths) {
      set.styles.push(await readImageAsDataUrl(resolveDataPath(styleRel)));
    }
  }

  if (competitorRelPath) {
    set.competitor = await readImageAsDataUrl(resolveDataPath(competitorRelPath));
  }
  return set;
}

/** Teto de reference_images por endpoint do G-Labs. */
const MAX_REFS: Record<string, number> = {
  "gpt-image-2": 5, // POST /api/openai/generate
  glabs: 10, // POST /api/image/generate
};

export interface SelectedReferences {
  images: string[];
  /** Quantos styles foram descartados para caber no limite da engine. */
  droppedStyles: number;
}

/**
 * Monta o array final de referências respeitando o limite da engine.
 *
 * A ORDEM é contratual, não estética: `lib/prompt.ts` instrui o modelo a usar
 * a PRIMEIRA imagem como face e a ÚLTIMA como thumbnail a remodelar. Por isso
 * o corte só remove styles do meio — tirar a face ou o competitor, ou trocá-los
 * de posição, quebraria o modo remodelar silenciosamente.
 */
export function selectReferences(
  set: ReferenceSet,
  engine: EngineId
): SelectedReferences {
  const limit = MAX_REFS[engine] ?? 10;

  const fixed = (set.face ? 1 : 0) + (set.competitor ? 1 : 0);
  const styleBudget = Math.max(0, limit - fixed);
  const keptStyles = set.styles.slice(0, styleBudget);

  const images = [
    ...(set.face ? [set.face] : []),
    ...keptStyles,
    ...(set.competitor ? [set.competitor] : []),
  ];

  return { images, droppedStyles: set.styles.length - keptStyles.length };
}

// Silencia o linter — PERSONAS_DIR é re-exportado via arquivos consumidores se necessário
void PERSONAS_DIR;
