/**
 * Orquestra a geração de variantes:
 *   - dispara N tasks paralelas
 *   - mantém o DB atualizado (variant.task_id, status, output_path, error_detail)
 *   - garante que `recomputeGenerationStatus` seja chamado após cada update
 *
 * Três provedores de imagem, nesta ordem de cascata:
 *   1. "chatgpt-auto" → fila própria no PC dos perfis (N contas ChatGPT)
 *   2. "gpt-image-2"  → GPT Image 2 pelo G-Labs
 *   3. "glabs"        → Nano Banana Pro pelo G-Labs
 *
 * Com engine "auto", a variante que falha é REENVIADA ao próximo provedor.
 * Escolher uma engine específica segue single-shot, para o usuário comparar
 * provedores sem o app trocar por baixo.
 *
 * O Claude cobre texto/análise, mas NÃO gera imagem.
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
import * as chatgptAuto from "./chatgpt-auto";
import {
  ENGINE_LABEL,
  deveCascatear,
  primeiroProvedor,
  proximoProvedor,
} from "./cascade";
import { generationsRepo } from "../db";
import { logger, explainEngineError } from "../logger";
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
  // "auto" não é provedor: resolve para o primeiro da cascata que esteja
  // configurado. As variantes sempre nascem apontando para um provedor real.
  const inicial = ctx.engine === "auto" ? primeiroProvedor() : ctx.engine;
  const variants: GenerationVariant[] = [];
  for (let i = 0; i < ctx.variantCount; i++) {
    const v = variantsRepo.create({
      id: nanoid(12),
      generationId: ctx.generationId,
      variantIndex: i,
      engineUsed: inicial,
    });
    variants.push(v);
  }

  // Disparar em paralelo. Erros individuais não matam outras variantes.
  for (const v of variants) {
    void dispatchVariant(v.id, ctx.prompt, ctx.referenceImages, inicial).catch((err) => {
      console.error(`[orchestrator] variant ${v.id} crashed:`, err);
      variantsRepo.setFailed(
        v.id,
        err instanceof Error ? err.message : String(err)
      );
      recomputeGenerationStatus(ctx.generationId);
    });
  }
}

/** Submete a UM provedor. Devolve o id externo do trabalho. */
async function submitTo(
  engine: EngineId,
  prompt: string,
  referenceImages: string[]
): Promise<string> {
  if (engine === "chatgpt-auto") {
    return chatgptAuto.submitJob({ prompt, referenceImages, aspectRatio: "16:9" });
  }
  if (engine === "gpt-image-2") {
    return glabs.submitGptImage({ prompt, referenceImages, aspectRatio: "16:9" });
  }
  return glabs.submitImage({
    prompt,
    referenceImages,
    aspectRatio: "16:9",
    model: "nano_banana_pro",
  });
}

async function dispatchVariant(
  variantId: string,
  prompt: string,
  referenceImages: string[],
  engine: EngineId
): Promise<void> {
  try {
    const taskId = await submitTo(engine, prompt, referenceImages);
    variantsRepo.setTaskId(variantId, taskId, engine);
    logger.info("engine", `Task submetida (${engine})`, {
      variantId,
      engine,
      taskId,
      generationId: variantsRepo.get(variantId)?.generationId ?? null,
      detail: { referencias: referenceImages.length },
    });
  } catch (err) {
    const variant = variantsRepo.get(variantId);
    const msg = err instanceof Error ? err.message : String(err);
    logger.error("engine", `Falha ao submeter task (${engine}): ${msg}`, {
      variantId,
      engine,
      generationId: variant?.generationId ?? null,
      detail: err,
    });
    // Falha de SUBMISSÃO (provedor fora do ar, chave errada) é justamente onde
    // trocar de provedor mais vale — não pode encerrar a variante direto.
    // A recursão termina sozinha: cada passo avança na cascata até não haver
    // próximo, e aí `falharOuCascatear` marca como falha.
    if (variant) {
      await falharOuCascatear({ ...variant, engineUsed: engine }, msg, null);
      recomputeGenerationStatus(variant.generationId);
    }
  }
}

/** Engines que expõem task_id no /api/status do G-Labs. "gemini" é legado. */
const POLLABLE: ReadonlySet<EngineId> = new Set<EngineId>([
  "glabs",
  "gpt-image-2",
  "chatgpt-auto",
]);

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
  if (v.engineUsed === "chatgpt-auto") return pollChatgptAuto(v);
  return pollGlabs(v);
}

/** Grava a imagem e marca a variante como concluída. */
async function concluir(
  v: GenerationVariant,
  buffer: Buffer,
  filename: string
): Promise<void> {
  const ext = path.extname(filename) || ".png";
  const outAbs = path.join(
    OUTPUT_DIR,
    v.generationId,
    `variant_${v.variantIndex}${ext}`
  );
  await writeBuffer(outAbs, buffer);
  variantsRepo.setCompleted(v.id, toRelative(outAbs));
  logger.info(
    "engine",
    `Variante concluída (${ENGINE_LABEL[v.engineUsed] ?? v.engineUsed})`,
    {
      variantId: v.id,
      generationId: v.generationId,
      engine: v.engineUsed,
      taskId: v.taskId,
    }
  );
}

/**
 * Falhou num provedor: tenta o próximo da cascata, ou encerra a variante.
 *
 * Só cascateia quando a geração foi pedida em modo "auto". Escolher uma engine
 * específica continua single-shot, para o usuário conseguir comparar
 * provedores sem que o app troque por baixo.
 */
async function falharOuCascatear(
  v: GenerationVariant,
  mensagem: string,
  errorCode: number | null
): Promise<void> {
  const geracao = generationsRepo.get(v.generationId);
  const emCascata = geracao?.engineRequested === "auto";

  const proximo = proximoProvedor(v.engineUsed);

  if (!emCascata || !proximo || !deveCascatear({ errorCode, mensagem })) {
    variantsRepo.setFailed(v.id, mensagem);
    logger.error(
      "engine",
      `Variante falhou (${ENGINE_LABEL[v.engineUsed] ?? v.engineUsed}): ${mensagem}`,
      {
        variantId: v.id,
        generationId: v.generationId,
        engine: v.engineUsed,
        taskId: v.taskId,
        errorCode,
        detail: {
          cascata: emCascata,
          proximoProvedor: proximo ?? null,
          motivoDeParar: !emCascata
            ? "engine fixa, sem cascata"
            : !proximo
              ? "último provedor da cascata"
              : "erro que se repetiria no próximo provedor",
        },
      }
    );
    return;
  }

  logger.warn(
    "engine",
    `${ENGINE_LABEL[v.engineUsed] ?? v.engineUsed} falhou — tentando ${
      ENGINE_LABEL[proximo] ?? proximo
    }`,
    {
      variantId: v.id,
      generationId: v.generationId,
      engine: v.engineUsed,
      taskId: v.taskId,
      errorCode,
      detail: { motivo: mensagem, proximoProvedor: proximo },
    }
  );

  // As referências não ficam guardadas — são reconstruídas do registro da
  // geração, que é a fonte de verdade de persona e competitor.
  try {
    const set = await loadReferencesForGeneration(
      geracao!.personaId,
      geracao!.competitorPath
    );
    const { images } = selectReferences(set, proximo);
    variantsRepo.setStatus(v.id, "pending");
    await dispatchVariant(v.id, geracao!.promptFinal, images, proximo);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    variantsRepo.setFailed(
      v.id,
      `${mensagem} — e a troca para ${proximo} falhou: ${msg}`
    );
    logger.error("engine", `Cascata para ${proximo} falhou: ${msg}`, {
      variantId: v.id,
      generationId: v.generationId,
      detail: err,
    });
  }
}

/** Polling do ChatGPT Auto: fila própria, status done/error. */
async function pollChatgptAuto(v: GenerationVariant): Promise<void> {
  try {
    const job = await chatgptAuto.getJob(v.taskId!);
    if (job.status === "pending" || job.status === "delivered") return;

    if (job.status === "done") {
      const { buffer, filename } = await chatgptAuto.downloadResult(job);
      await concluir(v, buffer, filename);
      return;
    }

    // Este provedor não usa código numérico: o motivo vem em texto livre.
    await falharOuCascatear(
      v,
      job.error ?? "ChatGPT Auto falhou sem motivo",
      null
    );
  } catch (err) {
    await falharOuCascatear(
      v,
      err instanceof Error ? err.message : String(err),
      null
    );
  }
}

/** Polling do G-Labs, comum aos canais Nano Banana e GPT Image 2. */
async function pollGlabs(v: GenerationVariant): Promise<void> {
  try {
    const status = await glabs.getStatus(v.taskId!);
    if (status.status === "pending" || status.status === "running") return;

    if (status.status === "completed") {
      const result = status.results?.[0];
      if (!result) {
        await falharOuCascatear(v, "G-Labs reportou completed sem results", null);
        return;
      }
      const { buffer, filename } = await glabs.downloadResult(result);
      await concluir(v, buffer, filename);
      return;
    }

    const rawDetail =
      status.error_detail ??
      status.error ??
      `error_code=${status.error_code ?? "?"}`;

    // O error_code é evidência muito melhor que o texto da mensagem — foi ele
    // que identificou a falha do GPT Image 2 (code 0 = ambiente), num caso em
    // que a mensagem apontava para prompt e imagens.
    const byCode = explainEngineError(status.error_code, v.engineUsed);
    const looksGeneric =
      /no images? generated|empty result|no result|failed to generate|nothing returned/i.test(
        rawDetail
      );
    const hint =
      byCode ??
      (looksGeneric ? "provável violação de política de conteúdo do provedor." : null);

    await falharOuCascatear(
      v,
      hint ? `${rawDetail} — ${hint}` : rawDetail,
      status.error_code ?? null
    );
  } catch (err) {
    await falharOuCascatear(
      v,
      err instanceof Error ? err.message : String(err),
      null
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
  "chatgpt-auto": 8, // fila própria — teto declarado na doc dela
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
