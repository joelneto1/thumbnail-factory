/**
 * Orquestra a geração de variantes no G-Labs:
 *   - dispara N tasks paralelas
 *   - mantém o DB atualizado (variant.task_id, status, output_path, error_detail)
 *   - garante que `recomputeGenerationStatus` seja chamado após cada update
 *
 * G-Labs é a ÚNICA engine de imagem (sem fallback). O Claude cobre texto/análise,
 * mas NÃO gera imagem — se o G-Labs falhar, a variante falha. (RunPod/FLUX.2
 * entra como segundo provider numa fase futura.)
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
    void dispatchVariant(v.id, ctx.prompt, ctx.referenceImages).catch((err) => {
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
  referenceImages: string[]
): Promise<void> {
  try {
    const taskId = await glabs.submitImage({
      prompt,
      referenceImages,
      aspectRatio: "16:9",
      model: "nano_banana_pro",
    });
    variantsRepo.setTaskId(variantId, taskId, "glabs");
  } catch (err) {
    const variant = variantsRepo.get(variantId);
    variantsRepo.setFailed(
      variantId,
      err instanceof Error ? err.message : String(err)
    );
    if (variant) recomputeGenerationStatus(variant.generationId);
  }
}

/**
 * Polling server-side para variantes G-Labs em pending/running.
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
    if (v.engineUsed !== "glabs") continue;
    if (!v.taskId) continue;

    work.push(pollOneGlabs(v));
  }

  if (work.length) {
    await Promise.allSettled(work);
    recomputeGenerationStatus(generationId);
  }
}

async function pollOneGlabs(v: GenerationVariant): Promise<void> {
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

      // G-Labs (via Chrome ext → labs.google) repassa só "No images generated"
      // quando a Google bloqueia por política de conteúdo. Detectamos esse
      // padrão e adicionamos contexto, já que o nano_banana_pro não retorna
      // a razão do bloqueio.
      const looksGeneric =
        /no images? generated|empty result|no result|failed to generate|nothing returned/i.test(
          rawDetail
        );
      const detail = looksGeneric
        ? `${rawDetail} — provável violação de política de conteúdo no labs.google (a imagem do concorrente ou o prompt foi vetado pela Google). Tente outro competitor ou reformule.`
        : rawDetail;

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

/**
 * Helper público: carrega face + styles + competitor (se houver) como
 * data URLs, na ordem que vai para a API:
 *   [face, ...styles, competitor?]
 *
 * Se personaId for null/undefined, pula face/styles — usado quando o
 * usuário gera "do absoluto zero" sem fixar uma persona.
 */
export async function loadReferencesForGeneration(
  personaId: string | null | undefined,
  competitorRelPath: string | null
): Promise<string[]> {
  const refs: string[] = [];

  if (personaId) {
    const persona = personasRepo.get(personaId);
    if (!persona) throw new Error(`Persona ${personaId} não existe`);
    if (persona.facePath) {
      refs.push(await readImageAsDataUrl(resolveDataPath(persona.facePath)));
    }
    for (const styleRel of persona.stylePaths) {
      refs.push(await readImageAsDataUrl(resolveDataPath(styleRel)));
    }
  }

  if (competitorRelPath) {
    refs.push(await readImageAsDataUrl(resolveDataPath(competitorRelPath)));
  }
  return refs;
}

// Silencia o linter — PERSONAS_DIR é re-exportado via arquivos consumidores se necessário
void PERSONAS_DIR;
