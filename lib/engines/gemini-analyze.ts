/**
 * Análise estruturada de uma thumbnail concorrente via Gemini Flash.
 * Usado pra extrair texto, cores, objetos e composição — alimenta o
 * "Modo Remodelar" do Workbench.
 */
import {
  GoogleGenerativeAI,
  type Part,
  type Schema,
  SchemaType,
} from "@google/generative-ai";

import { getGeminiApiKey } from "../settings";
import { GeminiError } from "./gemini";
import type { AnalysisResult } from "../types";

const ANALYSIS_MODEL = "gemini-2.5-flash";

const responseSchema: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    detectedText: {
      type: SchemaType.ARRAY,
      description: "Cada bloco de texto visível na thumbnail",
      items: {
        type: SchemaType.OBJECT,
        properties: {
          text: { type: SchemaType.STRING },
          position: {
            type: SchemaType.STRING,
            description: "Ex: top-left, center, banner-top, lower-right",
          },
          color: { type: SchemaType.STRING, description: "Ex: white, yellow, white-on-red" },
          style: {
            type: SchemaType.STRING,
            description: "Ex: bold-banner, main-headline, small-caption",
          },
        },
        required: ["text", "position"],
      },
    },
    dominantColors: {
      type: SchemaType.ARRAY,
      description: "Top 3-5 cores que dominam a composição",
      items: {
        type: SchemaType.OBJECT,
        properties: {
          hex: { type: SchemaType.STRING, description: "Hex code, ex: #1a4fa0" },
          name: { type: SchemaType.STRING, description: "Nome legível em PT-BR" },
          role: {
            type: SchemaType.STRING,
            description: "Ex: background, accent, text, banner",
          },
        },
        required: ["hex", "name"],
      },
    },
    objects: {
      type: SchemaType.ARRAY,
      description: "Objetos/elementos visuais distintos (não inclua texto)",
      items: {
        type: SchemaType.OBJECT,
        properties: {
          name: {
            type: SchemaType.STRING,
            description: "Descrição curta em PT-BR, ex: 'abacate cortado ao meio'",
          },
          position: {
            type: SchemaType.STRING,
            description: "Ex: center, right-third, lower-left",
          },
        },
        required: ["name", "position"],
      },
    },
    composition: {
      type: SchemaType.STRING,
      description: "Frase curta descrevendo o layout geral",
    },
    suggestedHeadlineTop: {
      type: SchemaType.STRING,
      description:
        "Se houver banner top, sugira aqui o texto detectado (em CAPS)",
    },
    suggestedHeadlineMainWhite: {
      type: SchemaType.STRING,
      description:
        "Headline principal em branco/claro detectada (em CAPS)",
    },
    suggestedHeadlineMainYellow: {
      type: SchemaType.STRING,
      description:
        "Headline em amarelo detectada (em CAPS)",
    },
    suggestedConcept: {
      type: SchemaType.STRING,
      description:
        "Frase curta em INGLÊS descrevendo o objeto central da thumb (formato pronto pra ir no campo 'Conceito visual')",
    },
  },
  required: [
    "detectedText",
    "dominantColors",
    "objects",
    "composition",
  ],
};

const ANALYSIS_PROMPT = `You are analyzing a YouTube thumbnail to help a content creator remodel it with their own persona and message.

Extract from the image:
1. Every readable text block: the literal text, where it sits, its color, and its style/role (e.g., "bold-banner", "main-headline").
2. The dominant colors with hex codes and a short PT-BR name and role.
3. The distinct visual objects/elements (NOT text). Use short PT-BR descriptions.
4. A one-sentence composition summary.
5. Suggestions to populate "remodel" form fields: top banner text, main white headline, main yellow headline (all in CAPS, copying the original text), and a one-sentence ENGLISH concept describing the central hero object/scene (so it can be reused as a prompt directly).

Be concise. Return ONLY the structured JSON — no extra commentary.`;

function dataUrlToPart(dataUrl: string): Part {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) throw new GeminiError("Data URL inválido");
  return {
    inlineData: { mimeType: match[1], data: match[2] },
  };
}

function isTransientGeminiError(err: unknown): boolean {
  // Google retorna 503 (UNAVAILABLE) em pico de demanda e 429 (RESOURCE_EXHAUSTED) em rate-limit.
  // O SDK joga o status no .message como string — não há código tipado, então casamos por substring.
  const msg = err instanceof Error ? err.message : String(err);
  return /\b503\b|UNAVAILABLE|\b429\b|RESOURCE_EXHAUSTED|overload/i.test(msg);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function analyzeImage(dataUrl: string): Promise<AnalysisResult> {
  const key = getGeminiApiKey();
  if (!key) {
    throw new GeminiError("GEMINI_API_KEY não configurada — análise indisponível");
  }
  const client = new GoogleGenerativeAI(key);
  const model = client.getGenerativeModel({
    model: ANALYSIS_MODEL,
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema,
      temperature: 0.2,
    },
  });

  // Retry com backoff exponencial em 503/429 — eventos comuns do Gemini Flash em pico.
  const MAX_ATTEMPTS = 3;
  let lastErr: unknown = null;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const result = await model.generateContent({
        contents: [
          {
            role: "user",
            parts: [{ text: ANALYSIS_PROMPT }, dataUrlToPart(dataUrl)],
          },
        ],
      });
      const text = result.response.text();
      try {
        return JSON.parse(text) as AnalysisResult;
      } catch {
        throw new GeminiError("Gemini retornou JSON inválido", text);
      }
    } catch (err) {
      lastErr = err;
      if (attempt < MAX_ATTEMPTS && isTransientGeminiError(err)) {
        await sleep(1000 * Math.pow(2, attempt - 1));
        continue;
      }
      break;
    }
  }

  if (isTransientGeminiError(lastErr)) {
    throw new GeminiError(
      "Gemini está sobrecarregado no momento (erro 503). Espera alguns segundos e clica em 'Recriar viral' de novo — ou adiciona os swaps manualmente."
    );
  }
  throw lastErr instanceof Error
    ? lastErr
    : new GeminiError(String(lastErr));
}
