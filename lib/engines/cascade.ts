import type { EngineId } from "../types";
import { isChatgptAutoConfigured } from "../settings";

/**
 * Ordem da cascata e a regra de quando vale tentar o próximo provedor.
 *
 * A ordem é decisão de produto, não técnica: o ChatGPT Auto vem primeiro por
 * ser o de maior capacidade (contas × abas) e o único sob controle direto.
 */
export const CASCADE_ORDER: EngineId[] = [
  "chatgpt-auto", // 1º — fila própria, N contas ChatGPT
  "gpt-image-2", // 2º — GPT Image 2 pelo G-Labs
  "glabs", // 3º — Nano Banana Pro, filtro de conteúdo diferente
];

export const ENGINE_LABEL: Record<string, string> = {
  "chatgpt-auto": "ChatGPT Auto",
  "gpt-image-2": "GPT Image 2 (G-Labs)",
  glabs: "Nano Banana Pro",
};

/**
 * Decide se a falha justifica tentar o próximo provedor.
 *
 * Cascatear em TUDO desperdiça cota: uma requisição malformada, ou uma
 * referência que não pôde ser lida, falha idêntico nos três e só atrasa o
 * erro que o usuário precisa ver. Já política, cota, ambiente e timeout são
 * específicos do provedor — é exatamente aí que trocar resolve.
 *
 * Na dúvida, cascateia: o custo de uma tentativa a mais é menor que o de uma
 * geração perdida.
 */
export function deveCascatear(motivo: {
  errorCode?: number | null;
  mensagem?: string | null;
}): boolean {
  const msg = (motivo.mensagem ?? "").toLowerCase();

  // Erros que se repetiriam igual adiante — parar aqui é mais honesto.
  const inutilTentarDeNovo = [
    "não consegui baixar as imagens de referência",
    "nao consegui baixar as imagens de referencia",
    "resultado sem url",
    "não foi possível extrair o arquivo",
    "sem imagem", // job concluído sem imagem: defeito nosso, não do provedor
  ];
  if (inutilTentarDeNovo.some((p) => msg.includes(p))) return false;

  // Chave errada não melhora trocando de provedor... mas o PRÓXIMO provedor
  // tem outra chave, então vale seguir.
  return true;
}

/** Ordem efetiva a partir da engine escolhida, sem repetir a que já falhou. */
export function ordemAPartirDe(inicial: EngineId): EngineId[] {
  const i = CASCADE_ORDER.indexOf(inicial);
  if (i < 0) return [inicial];
  return CASCADE_ORDER.slice(i);
}

/**
 * Provedor sem configuração é PULADO, não tentado.
 *
 * Sem isto, quem não preencheu CHATGPT_AUTO_API_KEY perderia a primeira
 * tentativa de toda geração num erro previsível.
 */
export function provedorDisponivel(engine: EngineId): boolean {
  if (engine === "chatgpt-auto") return isChatgptAutoConfigured();
  return true;
}

/** Primeiro provedor utilizável da cascata. */
export function primeiroProvedor(): EngineId {
  return CASCADE_ORDER.find(provedorDisponivel) ?? "glabs";
}

/** Próximo provedor utilizável depois de `atual`. */
export function proximoProvedor(atual: EngineId): EngineId | undefined {
  const i = CASCADE_ORDER.indexOf(atual);
  if (i < 0) return undefined;
  return CASCADE_ORDER.slice(i + 1).find(provedorDisponivel);
}
