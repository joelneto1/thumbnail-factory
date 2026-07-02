/**
 * Cliente do CLI Proxy (Claude Opus 4.8) — endpoint compatível com a API da
 * OpenAI (`POST {base}/chat/completions`). Serve TEXTO e VISÃO (imagem via
 * `image_url` com data URL base64).
 *
 * Substitui o Gemini nos papéis de: sugestão/enriquecimento de prompt (texto)
 * e análise de thumbnail do concorrente (visão). Geração de imagem continua no
 * G-Labs — o Claude não gera imagens.
 *
 * Doc de integração: CLI_Proxy_Integracao.md (fornecido pelo usuário).
 */
import {
  getCliProxyBaseUrl,
  getCliProxyApiKey,
  getCliProxyModel,
  getCliProxyReasoningEffort,
  isClaudeConfigured as isConfiguredFromSettings,
} from "../settings";

export class ClaudeError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "ClaudeError";
  }
}

export function isClaudeConfigured(): boolean {
  return isConfiguredFromSettings();
}

const RETRYABLE = new Set([429, 500, 502, 503, 504]);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Extrai o texto da resposta. Modelos com "thinking" às vezes mandam o texto
 * em reasoning_content/reasoning/reasoning_details em vez de content — cobre
 * todos, senão a resposta vem vazia às vezes.
 */
function extractText(message: Record<string, unknown>): string {
  let text = typeof message.content === "string" ? message.content : "";
  if (!text.trim()) {
    text =
      (typeof message.reasoning_content === "string"
        ? message.reasoning_content
        : "") ||
      (typeof message.reasoning === "string" ? message.reasoning : "");
  }
  if (!text.trim() && Array.isArray(message.reasoning_details)) {
    const parts: string[] = [];
    for (const d of message.reasoning_details) {
      if (d && typeof d === "object") {
        const o = d as Record<string, unknown>;
        parts.push((o.text as string) || (o.summary as string) || "");
      } else if (typeof d === "string") {
        parts.push(d);
      }
    }
    text = parts.filter(Boolean).join("\n");
  }
  return text.trim();
}

type ContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string | ContentPart[];
}

export interface CallClaudeParams {
  system?: string;
  /** Texto do usuário (prompt principal). */
  user: string;
  /** Data URLs (data:image/...;base64,...) anexadas como image_url. */
  images?: string[];
  /** none|low|medium|high. undefined = usa o default das settings. */
  reasoningEffort?: string | null;
  maxTokens?: number;
  temperature?: number;
  timeoutMs?: number;
  maxRetries?: number;
}

/**
 * Uma chamada de chat-completion ao CLI Proxy, com retries (429/5xx/timeout).
 * Retorna o texto da resposta (cobrindo o caso de vir em reasoning_content).
 */
export async function callClaude(params: CallClaudeParams): Promise<string> {
  const apiKey = getCliProxyApiKey();
  if (!apiKey) {
    throw new ClaudeError("CLI_PROXY_API_KEY não configurada");
  }
  const baseUrl = getCliProxyBaseUrl().replace(/\/$/, "");
  const model = getCliProxyModel();
  const reasoning =
    params.reasoningEffort === undefined
      ? getCliProxyReasoningEffort()
      : params.reasoningEffort;

  const messages: ChatMessage[] = [];
  if (params.system) messages.push({ role: "system", content: params.system });

  if (params.images && params.images.length > 0) {
    const parts: ContentPart[] = [{ type: "text", text: params.user }];
    for (const img of params.images) {
      parts.push({ type: "image_url", image_url: { url: img } });
    }
    messages.push({ role: "user", content: parts });
  } else {
    messages.push({ role: "user", content: params.user });
  }

  const payload: Record<string, unknown> = { model, messages };
  if (reasoning) payload.reasoning_effort = reasoning;
  if (typeof params.temperature === "number") {
    payload.temperature = params.temperature;
  }
  if (typeof params.maxTokens === "number") payload.max_tokens = params.maxTokens;

  const maxRetries = params.maxRetries ?? 3;
  const timeoutMs = params.timeoutMs ?? 300_000;
  const backoff = (attempt: number) => 1000 * 2 ** attempt;
  let lastErr: unknown = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), timeoutMs);
    let resp: Response;
    try {
      resp = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        signal: ac.signal,
        cache: "no-store",
      });
    } catch (err) {
      // Erro de rede ou timeout (abort) — retryable.
      clearTimeout(t);
      lastErr = err;
      if (attempt < maxRetries) {
        await sleep(backoff(attempt));
        continue;
      }
      break;
    }
    clearTimeout(t);

    if (RETRYABLE.has(resp.status)) {
      lastErr = new ClaudeError(`CLI Proxy HTTP ${resp.status}`);
      if (attempt < maxRetries) {
        await sleep(backoff(attempt));
        continue;
      }
      break;
    }
    if (!resp.ok) {
      // 4xx não-retryable (ex: 401 chave inválida) — falha imediata.
      const body = await resp.text().catch(() => "");
      throw new ClaudeError(
        `CLI Proxy respondeu ${resp.status}: ${body.slice(0, 300)}`
      );
    }

    let json: { choices?: Array<{ message?: Record<string, unknown> }> };
    try {
      json = (await resp.json()) as typeof json;
    } catch {
      lastErr = new ClaudeError("CLI Proxy retornou resposta não-JSON");
      if (attempt < maxRetries) {
        await sleep(backoff(attempt));
        continue;
      }
      break;
    }

    const msg = json.choices?.[0]?.message;
    const text = msg ? extractText(msg) : "";
    if (text) return text;

    lastErr = new ClaudeError("CLI Proxy retornou conteúdo vazio");
    if (attempt < maxRetries) {
      await sleep(backoff(attempt));
      continue;
    }
    break;
  }

  throw lastErr instanceof Error
    ? lastErr
    : new ClaudeError("CLI Proxy: tentativas esgotadas");
}

/**
 * Extrai o primeiro objeto JSON de um texto (tolera cercas ```json e prosa
 * ao redor). Usado quando pedimos JSON estruturado ao modelo.
 */
export function extractJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start >= 0 && end > start) return candidate.slice(start, end + 1);
  return candidate.trim();
}
