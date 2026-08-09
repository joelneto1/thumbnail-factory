import { logger } from "./logger";

/**
 * Envelopa um handler de rota para que NENHUMA falha passe sem registro.
 *
 * Existe porque a instrumentação manual sempre deixa buracos: o upload de
 * persona quebrou e não apareceu em /logs, porque aquela rota específica não
 * tinha chamada de logger. Com o wrapper, a cobertura passa a ser por
 * construção — toda resposta 4xx/5xx e toda exceção viram entrada, mesmo em
 * caminhos de erro que ninguém previu.
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
    let res: Response;

    try {
      res = await handler(...args);
    } catch (err) {
      // Exceção não tratada: sem isto vira um 500 opaco do Next, sem rastro.
      logger.error(scope, `${action} — exceção não tratada`, {
        detail: err,
      });
      throw err;
    }

    if (res.status >= 400) {
      const body = await errorBody(res);
      const level = res.status >= 500 ? "error" : "warn";
      // 401 é ruído: acontece a cada aba aberta sem sessão e não é problema.
      if (res.status !== 401) {
        logger[level](scope, `${action} → HTTP ${res.status}`, {
          detail: {
            status: res.status,
            duracaoMs: Date.now() - started,
            resposta: body,
          },
        });
      }
    }

    return res;
  };
}
