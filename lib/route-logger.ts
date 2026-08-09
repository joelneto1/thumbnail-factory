import { logger } from "./logger";
import { runWithActor } from "./actor-context";
import { getPrincipal } from "./auth/guard";

/**
 * Envelopa um handler de rota para que NENHUMA falha passe sem registro, e
 * para que toda entrada saiba QUEM originou a requisição.
 *
 * Existe porque a instrumentação manual sempre deixa buracos: o upload de
 * persona quebrou e não apareceu em /logs, porque aquela rota específica não
 * tinha chamada de logger. Com o wrapper, a cobertura passa a ser por
 * construção.
 *
 * Uso:
 *   export const POST = logged("personas", "criar persona", async (req) => { … });
 */

/** Corpo de erro é truncado: só o suficiente para identificar a causa. */
const MAX_BODY_CHARS = 600;

async function errorBody(res: Response): Promise<string | null> {
  try {
    // clone() é obrigatório — ler o corpo original o consumiria antes de o
    // cliente receber a resposta.
    const text = await res.clone().text();
    if (!text) return null;
    return text.length > MAX_BODY_CHARS
      ? `${text.slice(0, MAX_BODY_CHARS)}… (truncado)`
      : text;
  } catch {
    return null;
  }
}

export function logged<A extends unknown[]>(
  scope: string,
  action: string,
  handler: (...args: A) => Promise<Response>
): (...args: A) => Promise<Response> {
  return async (...args: A): Promise<Response> => {
    const started = Date.now();

    // Resolve o autor ANTES do handler, para que tudo que ele dispare — até o
    // orquestrador lá no fundo — registre a mesma origem.
    let actor = "anônimo";
    let viaApi = false;
    try {
      const p = await getPrincipal();
      if (p?.kind === "apiKey") {
        actor = `API: ${p.keyName}`;
        viaApi = true;
      } else if (p?.kind === "session") {
        actor = `sessão (${p.user})`;
      }
    } catch {
      // Falha ao identificar não pode impedir a requisição.
    }

    return runWithActor({ actor, viaApi }, async () => {
      let res: Response;
      try {
        res = await handler(...args);
      } catch (err) {
        // Exceção não tratada: sem isto vira um 500 opaco do Next, sem rastro.
        logger.error(scope, `${action} — exceção não tratada`, { detail: err });
        throw err;
      }

      const duracaoMs = Date.now() - started;

      if (res.status >= 400) {
        const body = await errorBody(res);
        const level = res.status >= 500 ? "error" : "warn";
        // 401 é ruído: acontece a cada aba aberta sem sessão e não é problema.
        if (res.status !== 401) {
          logger[level](scope, `${action} → HTTP ${res.status}`, {
            detail: { status: res.status, duracaoMs, resposta: body },
          });
        }
      } else if (viaApi) {
        // Requisição externa bem-sucedida também é registrada: é o rastro que
        // permite auditar o que cada sistema integrado fez. Requisição da
        // própria tela não entra, senão a trilha vira ruído de navegação.
        logger.info(scope, `${action} → HTTP ${res.status}`, {
          detail: { status: res.status, duracaoMs },
        });
      }

      return res;
    });
  };
}
