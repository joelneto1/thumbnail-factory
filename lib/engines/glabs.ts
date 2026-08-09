/**
 * Cliente para a API local da G-Labs.
 * Doc: references/GLABS_API_DOC.md
 */
import { getGlabsBaseUrl, getGlabsApiKey } from "../settings";

const baseUrl = () => getGlabsBaseUrl().replace(/\/$/, "");
const apiKey = () => getGlabsApiKey();

function authHeaders(): HeadersInit {
  return {
    "X-API-Key": apiKey(),
    "Content-Type": "application/json",
  };
}

export interface GlabsTaskStatus {
  task_id: string;
  status: "pending" | "running" | "completed" | "failed";
  results?: Array<string | { url?: string; filename?: string }>;
  error_code?: number;
  error_detail?: string;
  error?: string;
  prompt?: string;
}

export interface GlabsHealth {
  ok: boolean;
  uptime?: number;
  pending?: number;
  running?: number;
  raw?: unknown;
}

export class GlabsError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly detail?: unknown
  ) {
    super(message);
    this.name = "GlabsError";
  }
}

export async function checkGlabsHealth(timeoutMs = 4000): Promise<GlabsHealth> {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await fetch(`${baseUrl()}/api/health`, {
      cache: "no-store",
      signal: ac.signal,
    });
    if (!res.ok) return { ok: false };
    const data = (await res.json()) as Record<string, unknown>;
    return {
      ok: true,
      uptime: typeof data.uptime === "number" ? data.uptime : undefined,
      pending: typeof data.pending === "number" ? data.pending : undefined,
      running: typeof data.running === "number" ? data.running : undefined,
      raw: data,
    };
  } catch {
    return { ok: false };
  } finally {
    clearTimeout(t);
  }
}

/**
 * Submete uma geração ao G-Labs. Retorna o task_id.
 *
 * Para nano_banana_pro:
 *   - aspect_ratio aceita "16:9" ou "9:16"
 *   - reference_images é array de strings "data:image/...;base64,..."
 */
export async function submitImage(params: {
  prompt: string;
  referenceImages: string[]; // data URLs base64
  aspectRatio?: "16:9" | "9:16";
  model?: "nano_banana_pro" | "nano_banana_2" | "nano_banana";
}): Promise<string> {
  const body = {
    prompt: params.prompt,
    model: params.model ?? "nano_banana_pro",
    aspect_ratio: params.aspectRatio ?? "16:9",
    reference_images: params.referenceImages,
  };

  const res = await fetch(`${baseUrl()}/api/image/generate`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(body),
  });

  if (res.status === 401) {
    throw new GlabsError("G-Labs API key inválida ou faltando", 401);
  }
  if (!res.ok) {
    const text = await res.text();
    throw new GlabsError(
      `G-Labs rejeitou a geração (${res.status})`,
      res.status,
      text
    );
  }

  const data = (await res.json()) as { task_id?: string };
  if (!data.task_id) {
    throw new GlabsError("Resposta sem task_id", undefined, data);
  }
  return data.task_id;
}

/**
 * Submete uma geração ao GPT Image 2 (OpenAI via G-Labs). Retorna o task_id.
 *
 * Rota própria (`/api/openai/generate`), diferente de `/api/image/generate`:
 * não aceita `model` nem `upscale`, e o teto de referências é 5 (contra 10).
 *
 * `prompt_mode: "direct"` é deliberado. No default (`auto`) a OpenAI reescreve
 * o prompt antes de gerar, o que desmontaria a estrutura que `lib/prompt.ts`
 * monta (headlines posicionadas, âncora de composição, ordem das referências).
 */
export async function submitGptImage(params: {
  prompt: string;
  referenceImages: string[]; // data URLs base64, máx. 5
  aspectRatio?: "16:9" | "9:16";
}): Promise<string> {
  const body = {
    prompt: params.prompt,
    aspect_ratio: params.aspectRatio ?? "16:9",
    quality: "high",
    prompt_mode: "direct",
    reasoning: "medium",
    web_search: false,
    reference_images: params.referenceImages,
  };

  const res = await fetch(`${baseUrl()}/api/openai/generate`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(body),
  });

  if (res.status === 401) {
    throw new GlabsError("G-Labs API key inválida ou faltando", 401);
  }
  if (!res.ok) {
    const text = await res.text();
    throw new GlabsError(
      `GPT Image 2 rejeitou a geração (${res.status}) — confira se a conta ChatGPT está logada e habilitada no G-Labs`,
      res.status,
      text
    );
  }

  const data = (await res.json()) as { task_id?: string };
  if (!data.task_id) {
    throw new GlabsError("Resposta sem task_id", undefined, data);
  }
  return data.task_id;
}

export async function getStatus(taskId: string): Promise<GlabsTaskStatus> {
  const url = `${baseUrl()}/api/status/${taskId}`;
  let res: Response;
  try {
    res = await fetch(url, {
      headers: { "X-API-Key": apiKey() },
      cache: "no-store",
    });
  } catch (err) {
    throw new GlabsError(
      `G-Labs inacessível em ${url}: ${
        err instanceof Error ? err.message : String(err)
      }`,
      undefined,
      { url }
    );
  }
  if (!res.ok) {
    throw new GlabsError(`Status falhou (${res.status})`, res.status);
  }
  return (await res.json()) as GlabsTaskStatus;
}

/**
 * Reaponta a URL de um resultado para o host configurado, preservando só o
 * caminho.
 *
 * O G-Labs devolve `results` com URL ABSOLUTA do host dele — na prática
 * `http://127.0.0.1:8765/api/files/...`, porque é onde ele escuta. Usar isso
 * como veio só funciona na máquina que roda o G-Labs. No servidor,
 * `127.0.0.1` é o próprio container: a submissão passa (usa o base
 * configurado), o G-Labs gera, e o download morre com "fetch failed".
 *
 * Por isso o host do resultado nunca é confiável: vale o caminho.
 */
function resolveResultUrl(raw: string): string {
  const base = baseUrl();
  if (!raw) throw new GlabsError("Resultado sem URL");

  if (!/^https?:\/\//i.test(raw)) {
    return `${base}${raw.startsWith("/") ? "" : "/"}${raw}`;
  }
  try {
    const parsed = new URL(raw);
    return `${base}${parsed.pathname}${parsed.search}`;
  } catch {
    return `${base}${raw.startsWith("/") ? "" : "/"}${raw}`;
  }
}

/**
 * Baixa um arquivo de resultado. O formato dos `results` varia entre
 * versões da API (alguns retornam objeto com url/filename, outros só
 * string). Esta função aceita ambos.
 */
export async function downloadResult(
  result: string | { url?: string; filename?: string }
): Promise<{ buffer: Buffer; filename: string }> {
  const raw = typeof result === "string" ? result : result.url ?? "";
  const url = resolveResultUrl(raw);
  const filename =
    (typeof result === "string" ? undefined : result.filename) ??
    url.split("/").pop() ??
    "result.png";

  let res: Response;
  try {
    res = await fetch(url, {
      headers: { "X-API-Key": apiKey() },
      cache: "no-store",
    });
  } catch (err) {
    // "fetch failed" sozinho não diz nada; sem a URL não dá para saber se o
    // problema é host, rede ou túnel.
    throw new GlabsError(
      `Não foi possível baixar o resultado em ${url}: ${
        err instanceof Error ? err.message : String(err)
      }`,
      undefined,
      { url, original: raw }
    );
  }

  if (!res.ok) {
    throw new GlabsError(`Download falhou (${res.status}) em ${url}`, res.status);
  }
  const buffer = Buffer.from(await res.arrayBuffer());
  return { buffer, filename };
}
