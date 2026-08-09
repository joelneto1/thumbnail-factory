/**
 * Adaptação dos textos detectados numa thumbnail para outro idioma, via Claude
 * Opus 4.8 (CLI Proxy).
 *
 * O objetivo NÃO é traduzir. É recriar o gancho no idioma de destino, com a
 * gíria e o apelo que funcionam lá, cabendo no mesmo espaço da imagem.
 */
import { callClaude, ClaudeError, extractJson } from "./claude";

export interface TextToAdapt {
  original: string;
  position?: string;
  style?: string;
}

export interface AdaptedText {
  original: string;
  adapted: string;
}

const SYSTEM_PROMPT =
  "You are a senior YouTube thumbnail copywriter who adapts hooks across languages. You never translate literally — you rewrite the hook so it lands natively in the target language. You always return valid, minified JSON and nothing else.";

/**
 * O bloco de restrição de espaço é a parte que mais importa. Uma tradução fiel
 * mas comprida estoura a caixa de texto da imagem: o modelo de imagem encolhe a
 * fonte e a thumb deixa de ser legível no celular, que é onde ela é vista.
 * Português e alemão costumam ficar 20-30% mais longos que inglês.
 */
/**
 * Orçamento de caracteres por item.
 *
 * Instrução qualitativa ("mantenha próximo do original") é cumprida mal: no
 * teste, 2 de 5 itens estouraram em 4-5 caracteres. Número explícito por item
 * funciona muito melhor.
 *
 * A folga é generosa em textos curtos e apertada em textos longos — é o
 * inverso do que a proporção sozinha daria. "TO" (2 chars) não tem tradução
 * possível em 2 caracteres, enquanto uma manchete de 20 tem muita margem de
 * reescrita.
 */
function charBudget(original: string): number {
  const n = original.length;
  return Math.max(n + 3, Math.ceil(n * 1.15));
}

function buildUserPrompt(texts: TextToAdapt[], targetLanguage: string): string {
  const items = texts.map((t, i) => {
    const meta = [t.position, t.style].filter(Boolean).join(", ");
    return `${i + 1}. "${t.original}"${meta ? `  [${meta}]` : ""}  — MAX ${charBudget(
      t.original
    )} characters`;
  });

  return `Adapt the following YouTube thumbnail texts to ${targetLanguage}.

These texts come from a single thumbnail and appear together in one image. Treat them as ONE set, not as isolated strings.

TEXTS (with their position and role in the layout):
${items.join("\n")}

HOW TO ADAPT:
- Do NOT translate literally. Rewrite the hook so a native speaker of ${targetLanguage} feels the same curiosity and urgency the original creates.
- Use the idiom, slang and phrasing that actually perform in ${targetLanguage} thumbnails.
- Keep the emotional register of each item: a main-headline stays punchy, a small-caption stays secondary, a banner stays a label.
- Keep the set coherent: the items share one image, so avoid repeating the same word across items and preserve the hierarchy between them.

HARD CONSTRAINT — LENGTH:
Each item above has a "MAX N characters" budget. Every adapted text MUST be at or under its budget — count the characters before answering. Shorter is always better.

This is not a stylistic preference. The text sits in a fixed box in the image: going over makes the image model shrink the font until the thumbnail is unreadable on a phone, which defeats the whole purpose. If a faithful phrasing does not fit the budget, drop words and keep the hook — intent survives, length is non-negotiable.

OTHER RULES:
- Return every item in UPPERCASE, which is the thumbnail convention.
- Keep numbers, and keep proper names and brand names unchanged.
- Preserve punctuation that carries emphasis (?, !, …) when it still works in ${targetLanguage}.

Return ONLY a JSON object with this exact shape, in the same order as the input:

{"adaptations":[{"original":"<the original text, copied exactly>","adapted":"<the adapted text in ${targetLanguage}, UPPERCASE>"}]}`;
}

export async function adaptTexts(
  texts: TextToAdapt[],
  targetLanguage: string
): Promise<AdaptedText[]> {
  if (texts.length === 0) return [];

  const raw = await callClaude({
    system: SYSTEM_PROMPT,
    user: buildUserPrompt(texts, targetLanguage),
    // Alguma liberdade é necessária: transcriação exige escolher entre
    // formulações, não recuperar a mais provável.
    temperature: 0.7,
    reasoningEffort: "medium",
    // Proporcional à quantidade de textos. Um teto fixo trunca o JSON no meio
    // quando a thumb tem muitas linhas — thumbnails no estilo "história"
    // passam de 12 blocos de texto, e o raciocínio interno também consome
    // desse orçamento.
    maxTokens: Math.min(8000, 1500 + texts.length * 300),
    timeoutMs: 120_000,
  });

  const jsonText = extractJson(raw);
  let parsed: { adaptations?: AdaptedText[] };
  try {
    parsed = JSON.parse(jsonText) as { adaptations?: AdaptedText[] };
  } catch {
    // Resposta cortada no meio é o modo de falha mais comum aqui, e a
    // mensagem genérica de "JSON inválido" mandaria investigar o lugar errado.
    const truncated = !/[}\]]\s*$/.test(jsonText.trim());
    throw new ClaudeError(
      truncated
        ? `A resposta do Claude foi cortada antes de terminar (${jsonText.length} chars com ${texts.length} textos). Tente com menos textos em modo Swap.`
        : `Claude retornou JSON inválido na adaptação: ${raw.slice(0, 200)}`
    );
  }

  const list = Array.isArray(parsed.adaptations) ? parsed.adaptations : [];
  if (list.length === 0) {
    throw new ClaudeError("Claude não devolveu nenhuma adaptação");
  }

  // O modelo pode devolver fora de ordem ou com o original levemente alterado.
  // Casamos por posição, que é o contrato pedido no prompt, e usamos o texto
  // original que NÓS enviamos — nunca o que voltou.
  return texts.map((t, i) => ({
    original: t.original,
    adapted: (list[i]?.adapted ?? "").trim().toUpperCase(),
  }));
}
