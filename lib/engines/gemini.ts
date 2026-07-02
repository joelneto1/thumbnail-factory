/**
 * Cliente do Gemini API (engine fallback).
 * Usa o modelo gemini-2.5-flash-image-preview (Nano Banana Pro pago).
 */
import { GoogleGenerativeAI, type Part } from "@google/generative-ai";
import { getGeminiApiKey, isGeminiConfigured as isConfiguredFromSettings } from "../settings";

const MODEL_ID = "gemini-2.5-flash-image-preview";

export class GeminiError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "GeminiError";
  }
}

export function isGeminiConfigured(): boolean {
  return isConfiguredFromSettings();
}

function getClient() {
  const key = getGeminiApiKey();
  if (!key) {
    throw new GeminiError("GEMINI_API_KEY não configurada");
  }
  return new GoogleGenerativeAI(key);
}

/**
 * Converte um data URL (data:image/png;base64,...) em uma `Part`
 * compatível com o SDK Gemini.
 */
function dataUrlToPart(dataUrl: string): Part {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) {
    throw new GeminiError("Data URL inválido para reference image");
  }
  return {
    inlineData: {
      mimeType: match[1],
      data: match[2],
    },
  };
}

/**
 * Gera UMA imagem síncrona via Gemini. Retorna o buffer do PNG.
 *
 * Diferente do G-Labs (assíncrono com polling), o Gemini retorna
 * a imagem na mesma chamada.
 */
export async function generateImage(params: {
  prompt: string;
  referenceImages: string[]; // data URLs
}): Promise<{ buffer: Buffer; mimeType: string }> {
  const client = getClient();
  const model = client.getGenerativeModel({ model: MODEL_ID });

  const parts: Part[] = [
    { text: params.prompt },
    ...params.referenceImages.map(dataUrlToPart),
  ];

  const result = await model.generateContent({
    contents: [{ role: "user", parts }],
  });

  const response = result.response;

  // 1) Prompt-level block (Gemini recusou ANTES de processar)
  const promptBlock = (response as { promptFeedback?: { blockReason?: string; blockReasonMessage?: string } })
    .promptFeedback;
  if (promptBlock?.blockReason) {
    throw new GeminiError(
      `Bloqueado pelo Gemini (prompt): ${promptBlock.blockReason}${
        promptBlock.blockReasonMessage ? ` — ${promptBlock.blockReasonMessage}` : ""
      }. Reformule o prompt ou troque a imagem de referência.`
    );
  }

  const candidates = response.candidates ?? [];

  for (const cand of candidates) {
    // 2) Candidate-level block: finishReason indica SAFETY / PROHIBITED_CONTENT
    //    / IMAGE_SAFETY / RECITATION etc quando o conteúdo gerado foi vetado.
    const finishReason = (cand as { finishReason?: string }).finishReason;
    if (
      finishReason &&
      finishReason !== "STOP" &&
      finishReason !== "MAX_TOKENS"
    ) {
      throw new GeminiError(
        `Bloqueado pelo Gemini: ${finishReason}. Violação de política de conteúdo — geralmente significa imagem do concorrente ou prompt com elemento sensível (rosto, marca, conteúdo restrito).`
      );
    }

    const responseParts = cand.content?.parts ?? [];
    for (const p of responseParts) {
      const maybeInline = (p as { inlineData?: { data?: string; mimeType?: string } })
        .inlineData;
      if (maybeInline?.data) {
        return {
          buffer: Buffer.from(maybeInline.data, "base64"),
          mimeType: maybeInline.mimeType ?? "image/png",
        };
      }
    }
  }

  // Sem candidates e sem block-reason explícito — provável SAFETY silencioso.
  throw new GeminiError(
    "Gemini não retornou imagem. Provável bloqueio por política de conteúdo (resposta vazia sem reason explícito)."
  );
}
