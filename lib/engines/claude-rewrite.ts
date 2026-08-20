/**
 * Reescreve um prompt recusado por política de conteúdo, uma única vez, depois
 * que TODOS os provedores da cascata recusaram.
 *
 * Só entra em cena quando trocar de provedor já não resolveu — o que indica
 * que o gatilho está no texto, não no fornecedor. Foi o caso real em que a
 * frase "a smiling older woman in an apron" fazia a Google recusar: a mesma
 * requisição passou trocando a descrição por "the presenter".
 *
 * O objetivo é ESCLARECER a intenção, não driblar o filtro: a thumbnail é do
 * próprio canal do usuário, com o apresentador dele, e a referência serve de
 * layout. Quando o pedido original de fato exigia a semelhança de uma pessoa
 * real, a reescrita corrige isso em vez de insistir.
 */
import { callClaude, ClaudeError } from "./claude";

const SYSTEM_PROMPT =
  "You rewrite image-generation prompts that a provider's content filter refused. You keep the visual result identical and change only the wording. You return the rewritten prompt as plain text, with no preamble, no quotes and no commentary.";

function buildUserPrompt(prompt: string, motivo: string): string {
  return `An image provider refused this thumbnail prompt. Rewrite it so the same image can be produced without tripping the filter.

REFUSAL REPORTED BY THE PROVIDER:
${motivo}

THE PROMPT THAT WAS REFUSED:
---
${prompt}
---

HOW TO REWRITE — surgical, not creative:
- Swap loaded or forceful words for milder synonyms of the SAME meaning. "slammed" becomes "placed firmly", "hissed" becomes "said quietly", "attack" becomes "confront", "kill" becomes "stop". The scene does not change; the register softens.
- Describe people by their ROLE in the composition, never by physical appearance. "a smiling older woman in an apron" becomes "the presenter". Age, gender, body and clothing descriptions of a person are the single most common trigger, and they are never needed: the attached photo already defines who appears.
- Keep the reference framed as what it is — a LAYOUT and STYLE guide, not something to copy or to imitate a person from.
- Preserve, word for word, anything inside quotes: those are the texts that must be rendered in the image. Never soften, translate or reword them.
- Preserve every layout instruction: positions, colours, fonts, proportions, banner shapes, the number of lines. Losing these ruins the thumbnail.

WHAT NOT TO DO:
- Do not shorten the prompt or drop sections. Same structure, same length, milder wording.
- Do not add meta-commentary such as "this is a fictional scene" or "for artistic purposes". That reads as evasion and does not help.
- If the refusal was caused by asking for a real person's likeness, do not try to phrase it differently — remove the request for that likeness entirely and describe a generic person in the same role.

Return ONLY the rewritten prompt.`;
}

export async function rewriteBlockedPrompt(
  prompt: string,
  motivo: string
): Promise<string> {
  const raw = await callClaude({
    system: SYSTEM_PROMPT,
    user: buildUserPrompt(prompt, motivo),
    // Baixa de propósito: é edição cirúrgica de vocabulário, não criação.
    temperature: 0.3,
    reasoningEffort: "medium",
    // O prompt de thumbnail passa de 2500 caracteres e a reescrita mantém o
    // tamanho — teto apertado devolveria um prompt cortado, que é pior que a
    // recusa original.
    maxTokens: 4000,
    timeoutMs: 120_000,
  });

  const texto = raw.trim().replace(/^```[a-z]*\n?|\n?```$/g, "").trim();
  if (texto.length < 40) {
    throw new ClaudeError(
      `A reescrita voltou curta demais (${texto.length} caracteres) — provavelmente não é um prompt válido`
    );
  }
  return texto;
}

/**
 * A recusa foi por CONTEÚDO? Só nesse caso reescrever faz sentido.
 *
 * Cota, conta desconectada e timeout não têm nada a ver com o texto: reescrever
 * ali gastaria uma chamada ao Claude e uma rodada inteira da cascata para
 * chegar ao mesmo lugar.
 */
export function ehRecusaDeConteudo(
  mensagem: string | null | undefined,
  errorCode: number | null | undefined
): boolean {
  const msg = (mensagem ?? "").toLowerCase();

  // Sinais de cota/ambiente: explicitamente NÃO são recusa de conteúdo.
  const naoEhConteudo = [
    "rate limit",
    "atingiu limite",
    "quota",
    "cota",
    "não logado",
    "nao logado",
    "not logged",
    "timeout",
    "inacessível",
    "inacessivel",
    "no active accounts",
    "fetch failed",
  ];
  if (naoEhConteudo.some((p) => msg.includes(p))) return false;

  const sinais = [
    "policy",
    "política",
    "politica",
    "violat",
    "content violates",
    "moderation",
    "recusou",
    "refused",
    "rejected",
    "invalid argument",
    "respondeu sem gerar imagem",
    "no images generated",
    // O canal ChatGPT devolve texto livre; estes são os códigos e frases com
    // que ele recusa. "image_generation_user_error" é o código que a OpenAI
    // usa quando o pedido de imagem foi barrado.
    "image_generation_user_error",
    "safety",
    "flagged",
    "disallowed",
    "not allowed",
    "unable to generate",
    "can't generate",
    "cant generate",
  ];
  if (sinais.some((p) => msg.includes(p))) return true;

  // 400 do G-Labs é o balde de "requisição inválida / violação de política".
  return errorCode === 400;
}
