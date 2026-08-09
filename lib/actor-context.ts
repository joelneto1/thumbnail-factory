import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Carrega "quem originou esta requisição" pela pilha de chamadas, sem que cada
 * função precise receber isso como parâmetro.
 *
 * O logger é chamado de todo lado — rotas, orquestrador, cliente do G-Labs.
 * Passar o autor de mão em mão até lá dentro poluiria dezenas de assinaturas.
 * Com AsyncLocalStorage, o `logged()` abre o contexto uma vez por requisição e
 * tudo que roda dentro dele o enxerga, inclusive as continuações assíncronas.
 *
 * Trabalho disparado com fire-and-forget que sobrevive à resposta perde o
 * contexto — é o caso da geração em segundo plano. Mas o polling que a
 * acompanha roda dentro de /api/status, então os eventos de variante herdam o
 * autor de quem consultou.
 */

export interface ActorContext {
  /** Ex.: "sessão (joel)" ou "API: Hermes Agent". */
  actor: string;
  /** true quando veio de chave de API — usado para decidir o que logar. */
  viaApi: boolean;
}

const storage = new AsyncLocalStorage<ActorContext>();

export function runWithActor<T>(ctx: ActorContext, fn: () => T): T {
  return storage.run(ctx, fn);
}

export function currentActor(): string | null {
  return storage.getStore()?.actor ?? null;
}

export function isApiRequest(): boolean {
  return storage.getStore()?.viaApi ?? false;
}
