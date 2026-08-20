/**
 * Chave geral dos provedores de imagem — TEMPORÁRIA.
 *
 * Desligar um provedor aqui tira ele da cascata e some com ele do seletor do
 * Workbench, sem mexer no código que sabe conversar com ele. O histórico
 * continua mostrando corretamente as gerações que já saíram por esses canais.
 *
 * Em 20/08/2026, a pedido do usuário, ficou só o Nano Banana Pro. Para religar,
 * basta esvaziar esta lista — nada mais precisa mudar.
 *
 * Fica em arquivo próprio, sem dependências, porque o Workbench é componente
 * de cliente: `cascade.ts` puxa `settings`, que puxa o banco, e isso não pode
 * entrar no bundle do navegador.
 */
import type { EngineId } from "./types";

export const ENGINES_DESATIVADAS: readonly EngineId[] = [
  "chatgpt-auto",
  "gpt-image-2",
];

export function engineDesativada(engine: EngineId): boolean {
  return ENGINES_DESATIVADAS.includes(engine);
}

/** Nome de cada provedor na interface e nos logs. */
export const ENGINE_LABEL: Record<string, string> = {
  "chatgpt-auto": "ChatGPT Auto",
  "gpt-image-2": "GPT Image 2 (G-Labs)",
  glabs: "Nano Banana Pro",
};

/** Provedores da cascata que continuam ligados, na ordem. */
export const CASCATA_LIGADA: EngineId[] = (
  ["chatgpt-auto", "gpt-image-2", "glabs"] as EngineId[]
).filter((e) => !engineDesativada(e));
