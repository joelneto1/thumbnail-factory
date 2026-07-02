/**
 * Gemini text-only completions — usado pelo Prompt Assist do Workbench
 * pra expandir/gerar prompts ricos a partir de drafts curtos.
 */
import { GoogleGenerativeAI } from "@google/generative-ai";
import { getGeminiApiKey } from "../settings";
import { GeminiError } from "./gemini";

const TEXT_MODEL = "gemini-2.5-flash";

export interface SuggestPromptParams {
  draft?: string | null;
  personaName?: string | null;
  language?: "pt-BR" | "en";
}

const SYSTEM_INSTRUCTION = `Você é um diretor de arte especializado em thumbnails virais de YouTube.
Reescreva ou expanda o draft do usuário pra virar um prompt rico, visual e direto pro modelo de imagem (Nano Banana Pro / Gemini Flash Image).

Regras:
- 2-5 frases. Conciso.
- Foco no que aparece NA TELA (composição, pose, expressão, paleta, cenário, atmosfera).
- Estilo "thumbnail viral" — alto contraste, cores saturadas, drama documental, foco emocional.
- Em PT-BR a menos que o draft já esteja em outro idioma.
- NÃO use crases, NÃO use markdown, NÃO comente, só devolva o prompt final.
- Se o draft já estiver bom, polido e completo, devolva similar com pequenos ajustes.
- Se o draft estiver vazio ou genérico, gere algo concreto: pessoa específica, ação clara, paleta vibrante, atmosfera.`;

export async function suggestPrompt(params: SuggestPromptParams): Promise<string> {
  const key = getGeminiApiKey();
  if (!key) {
    throw new GeminiError("GEMINI_API_KEY não configurada — Prompt Assist indisponível");
  }

  const client = new GoogleGenerativeAI(key);
  const model = client.getGenerativeModel({
    model: TEXT_MODEL,
    systemInstruction: SYSTEM_INSTRUCTION,
    generationConfig: {
      temperature: 0.85,
      maxOutputTokens: 400,
    },
  });

  const draft = (params.draft ?? "").trim();
  const personaContext = params.personaName
    ? `A persona principal é "${params.personaName}". Refira-se a ela como "the person in the attached face reference" pra que o modelo de imagem use a face certa.`
    : "Não há persona fixa — o usuário pode estar gerando uma cena qualquer.";

  const userPrompt = draft
    ? `${personaContext}\n\nDraft do usuário:\n"""\n${draft}\n"""\n\nDevolva o prompt final.`
    : `${personaContext}\n\nO usuário não escreveu nada. Sugira um prompt pronto-pra-usar de uma thumbnail viral genérica mas concreta.`;

  const result = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: userPrompt }] }],
  });

  const text = result.response.text().trim();
  if (!text) {
    throw new GeminiError("Gemini retornou resposta vazia");
  }
  // Strip surrounding quotes/markdown that o modelo às vezes coloca.
  return text
    .replace(/^["'`]+|["'`]+$/g, "")
    .replace(/^```[a-z]*\n?|\n?```$/gi, "")
    .trim();
}
