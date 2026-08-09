import { logsRepo, type LogLevel } from "./db";

/**
 * Trilha de eventos do app, gravada no SQLite e exibida em /logs.
 *
 * Existe porque diagnosticar a falha do GPT Image 2 exigiu sondar a API do
 * G-Labs por fora: o app guardava só a mensagem amigável do erro e descartava
 * o `error_code`, que era justamente o campo que identificava a causa.
 *
 * Regra de ouro daqui: NUNCA deixar uma falha de log derrubar a operação que
 * estava sendo registrada. Todo insert é best-effort.
 */

export interface LogMeta {
  detail?: unknown;
  generationId?: string | null;
  variantId?: string | null;
  engine?: string | null;
  taskId?: string | null;
  errorCode?: number | null;
}

/** Teto por campo `detail`, pra um payload gigante não inchar o banco. */
const MAX_DETAIL_CHARS = 4000;

function serializeDetail(detail: unknown): string | null {
  if (detail === undefined || detail === null) return null;
  let text: string;
  if (typeof detail === "string") {
    text = detail;
  } else if (detail instanceof Error) {
    text = `${detail.name}: ${detail.message}${detail.stack ? `\n${detail.stack}` : ""}`;
  } else {
    try {
      text = JSON.stringify(detail, null, 2);
    } catch {
      text = String(detail);
    }
  }
  // Data URLs de referência têm centenas de KB — cortamos antes de medir.
  text = text.replace(
    /data:image\/[a-zA-Z]+;base64,[A-Za-z0-9+/=]{40,}/g,
    (m) => `<imagem base64 omitida, ${m.length} chars>`
  );
  return text.length > MAX_DETAIL_CHARS
    ? `${text.slice(0, MAX_DETAIL_CHARS)}\n… (truncado)`
    : text;
}

/** Contador para rodar o prune de vez em quando, não a cada insert. */
let sinceLastPrune = 0;
const PRUNE_EVERY = 200;

function write(
  level: LogLevel,
  scope: string,
  message: string,
  meta: LogMeta = {}
): void {
  try {
    logsRepo.insert({
      level,
      scope,
      message,
      detail: serializeDetail(meta.detail),
      generationId: meta.generationId ?? null,
      variantId: meta.variantId ?? null,
      engine: meta.engine ?? null,
      taskId: meta.taskId ?? null,
      errorCode: meta.errorCode ?? null,
    });

    sinceLastPrune += 1;
    if (sinceLastPrune >= PRUNE_EVERY) {
      sinceLastPrune = 0;
      logsRepo.prune();
    }
  } catch (err) {
    // Log é observabilidade, não função. Se o banco falhar aqui, a geração
    // (ou o login) tem que seguir do mesmo jeito.
    console.error("[logger] falhou ao gravar:", err);
  }

  const line = `[${scope}] ${message}`;
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const logger = {
  info: (scope: string, message: string, meta?: LogMeta) =>
    write("info", scope, message, meta),
  warn: (scope: string, message: string, meta?: LogMeta) =>
    write("warn", scope, message, meta),
  error: (scope: string, message: string, meta?: LogMeta) =>
    write("error", scope, message, meta),
};

/**
 * Traduz o error_code do G-Labs para uma dica acionável.
 *
 * A mensagem que o G-Labs devolve no code 0 do canal OpenAI é
 * "Invalid request. Check the prompt and reference images (format/size)",
 * que aponta para o lugar errado. Ela é o balde `oa_msg_bad_request` do
 * G-Labs; conteúdo e rate limit têm mensagens próprias (`oa_msg_moderation`,
 * `oa_msg_rate_limited`), então nenhum dos dois é a causa quando ela aparece.
 *
 * Causa confirmada pela plataforma: o canal OpenAI exige conta ChatGPT em
 * plano PAGO. Conta no tier Free falha aqui mesmo estando logada, habilitada
 * e com status válido — e falha igual pela interface do G-Labs, não só pela
 * webhook.
 *
 * Descartados por teste direto no caminho até essa conclusão: o app (o corpo
 * mínimo aceito pela API falha igual), o servidor do G-Labs (o canal Nano
 * Banana funciona no mesmo instante), conteúdo e cota (têm mensagens
 * próprias) e a licença do G-Labs — a família `msg_*_plus_only` é da licença
 * da ferramenta, cobre Workflow/Grok/Meta e a própria Webhook API, que exige
 * MAX e estava funcionando.
 */
export function explainEngineError(
  errorCode: number | null | undefined,
  engine: string | null | undefined
): string | null {
  const isGpt = engine === "gpt-image-2";
  switch (errorCode) {
    case 0:
      return isGpt
        ? "Erro de validação/ambiente — NÃO é o prompt nem as imagens, apesar do que a mensagem do G-Labs diz. Causa mais provável, confirmada pela plataforma: a conta ChatGPT está no plano Free, e o canal OpenAI exige plano pago. Confira o tier na aba OpenAI do G-Labs; se acabou de assinar, remova e re-adicione a conta para o tier ser relido."
        : "Erro de validação/ambiente no G-Labs. Confira se a conta Google está logada e habilitada na extensão.";
    case 429:
      return isGpt
        ? "Cota ou limite de threads da conta ChatGPT esgotado (máx. 5 simultâneas por conta). O G-Labs tenta rotacionar para outra conta antes de desistir."
        : "Cota diária da conta Google esgotada.";
    case 403:
      return "Permissão negada pela conta conectada na extensão.";
    case 400:
      return "Requisição recusada — normalmente política de conteúdo do provedor.";
    case 500:
      return "Erro no servidor do provedor. Tentar de novo costuma resolver.";
    default:
      return null;
  }
}
