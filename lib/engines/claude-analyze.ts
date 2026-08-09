/**
 * Análise estruturada de uma thumbnail concorrente via Claude Opus 4.8 (visão,
 * CLI Proxy). Extrai texto, cores, objetos e composição — alimenta o "Modo
 * Remodelar" do Workbench. (Antes era Gemini Flash.)
 */
import { callClaude, ClaudeError, extractJson } from "./claude";
import type { AnalysisResult } from "../types";

const ANALYSIS_PROMPT = `You are analyzing a YouTube thumbnail to help a content creator remodel it with their own persona and message.

Extract from the attached image and return ONLY a JSON object with EXACTLY this shape (no prose, no markdown fences):

{
  "detectedText": [ { "text": "<literal text>", "position": "<e.g. top-left, center, banner-top>", "color": "<e.g. white, yellow, white-on-red>", "style": "<e.g. bold-banner, main-headline, small-caption>" } ],
  "dominantColors": [ { "hex": "#1a4fa0", "name": "<short PT-BR name>", "role": "<background|accent|text|banner>" } ],
  "objects": [ { "name": "<short PT-BR description, NOT text>", "position": "<e.g. center, right-third, lower-left>" } ],
  "composition": "<one-sentence LAYOUT summary — see rules>",
  "suggestedHeadlineTop": "<top banner text in CAPS, or omit>",
  "suggestedHeadlineMainWhite": "<main white headline in CAPS, or omit>",
  "suggestedHeadlineMainYellow": "<main yellow headline in CAPS, or omit>",
  "suggestedConcept": "<one-sentence ENGLISH concept describing the central hero object/scene, ready to reuse as a prompt>"
}

Rules:
- "detectedText": ONE ENTRY PER VISUAL LINE of text, exactly as the line breaks appear in the image. NEVER merge several lines into a single entry, not even when they form one continuous sentence — the creator replaces the text line by line to keep the layout, so a merged block is useless. A thumbnail with 10 lines of story text must return 10 entries, in reading order. A colour change mid-sentence almost always marks a separate line: capture it as its own entry.
- Each entry carries its literal text, position, colour and style/role.
- "dominantColors": top 3-5 colors with hex, a short PT-BR name and role.
- "objects": distinct visual objects/elements (NOT text), short PT-BR descriptions.
- "composition": describe WHERE things sit — panels, text blocks, image areas, proportions. Refer to any person ONLY by their role in the layout ("the presenter", "the subject"), NEVER by appearance: no gender, no age, no clothing, no expression. Write "the right third holds the presenter", never "the right third shows a smiling older woman in an apron".
- Copy the original headline text into the suggested* fields, in CAPS.
- Be concise. Return ONLY the JSON.`;

export async function analyzeImage(dataUrl: string): Promise<AnalysisResult> {
  const raw = await callClaude({
    system:
      "You are a precise vision analyst. You always return valid, minified JSON and nothing else.",
    user: ANALYSIS_PROMPT,
    images: [dataUrl],
    temperature: 0.2,
    reasoningEffort: "low",
    maxTokens: 1500,
  });

  const jsonText = extractJson(raw);
  let parsed: AnalysisResult;
  try {
    parsed = JSON.parse(jsonText) as AnalysisResult;
  } catch {
    throw new ClaudeError(
      `Claude retornou JSON inválido na análise: ${raw.slice(0, 200)}`
    );
  }

  // Normaliza arrays obrigatórios (o modelo pode omitir algum).
  parsed.detectedText ??= [];
  parsed.dominantColors ??= [];
  parsed.objects ??= [];
  parsed.composition ??= "";
  return parsed;
}
