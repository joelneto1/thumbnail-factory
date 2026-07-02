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

export async function getStatus(taskId: string): Promise<GlabsTaskStatus> {
  const res = await fetch(`${baseUrl()}/api/status/${taskId}`, {
    headers: { "X-API-Key": apiKey() },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new GlabsError(`Status falhou (${res.status})`, res.status);
  }
  return (await res.json()) as GlabsTaskStatus;
}

/**
 * Baixa um arquivo de resultado. O formato dos `results` varia entre
 * versões da API (alguns retornam objeto com url/filename, outros só
 * string). Esta função aceita ambos.
 */
export async function downloadResult(
  result: string | { url?: string; filename?: string }
): Promise<{ buffer: Buffer; filename: string }> {
  let url: string;
  let filename: string;

  if (typeof result === "string") {
    url = result.startsWith("http")
      ? result
      : `${baseUrl()}${result.startsWith("/") ? "" : "/"}${result}`;
    filename = url.split("/").pop() ?? "result.png";
  } else {
    const u = result.url ?? "";
    url = u.startsWith("http") ? u : `${baseUrl()}${u.startsWith("/") ? "" : "/"}${u}`;
    filename = result.filename ?? url.split("/").pop() ?? "result.png";
  }

  const res = await fetch(url, {
    headers: { "X-API-Key": apiKey() },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new GlabsError(`Download falhou (${res.status})`, res.status);
  }
  const buffer = Buffer.from(await res.arrayBuffer());
  return { buffer, filename };
}
