/**
 * Cliente da ChatGPT Image Auto — 2º provedor de GPT Image 2, primeiro da
 * cascata.
 *
 * É um servidor de fila que roda no MESMO PC dos perfis do Chrome. Ele não
 * gera nada: enfileira o job, e uma extensão instalada em cada perfil puxa o
 * trabalho e gera no chatgpt.com. Capacidade = contas × abas simultâneas.
 *
 * O contrato é bem diferente do G-Labs, daí um cliente próprio:
 *   auth        Authorization: Bearer   (G-Labs usa X-API-Key)
 *   submeter    POST /api/generate      -> { jobId }
 *   consultar   GET  /api/jobs/{id}     -> done | error | pending | delivered
 *   baixar      GET  /api/jobs/{id}/images/{file}  (exige o header)
 *   erro        texto livre em `error`  (G-Labs usa error_code numérico)
 *
 * Referências vão em BASE64, no mesmo formato que já montamos para o G-Labs —
 * validado contra o servidor real. O modo URL da doc existe, mas exigiria que
 * o PC alcançasse nossos arquivos, e a própria doc registra que URL
 * inacessível foi "o erro nº 1 na integração real".
 */
import { getChatgptAutoBaseUrl, getChatgptAutoApiKey } from "../settings";

const baseUrl = () => getChatgptAutoBaseUrl().replace(/\/$/, "");

function authHeaders(): HeadersInit {
  return {
    Authorization: `Bearer ${getChatgptAutoApiKey()}`,
    "Content-Type": "application/json",
  };
}

export class ChatgptAutoError extends Error {
  constructor(
    message: string,
    public readonly detail?: unknown
  ) {
    super(message);
    this.name = "ChatgptAutoError";
  }
}

export interface ChatgptAutoJob {
  id: string;
  status: "pending" | "delivered" | "done" | "error";
  error?: string | null;
  deliveredTo?: string | null;
  images?: Array<{ file: string; mimeType: string; url: string }>;
}

/** Teto declarado na doc. */
export const MAX_REFS = 8;

export async function submitJob(params: {
  prompt: string;
  referenceImages: string[]; // data URLs, iguais às do G-Labs
  aspectRatio?: "16:9" | "9:16";
}): Promise<string> {
  const url = `${baseUrl()}/api/generate`;
  const body = {
    prompt: params.prompt,
    aspectRatio: params.aspectRatio ?? "16:9",
    // Sem `account`: o servidor entrega ao primeiro perfil livre, que é o
    // balanceamento natural entre as contas.
    referenceImages: params.referenceImages.slice(0, MAX_REFS),
  };

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(body),
    });
  } catch (err) {
    throw new ChatgptAutoError(
      `ChatGPT Auto inacessível em ${url}: ${
        err instanceof Error ? err.message : String(err)
      }`,
      { url }
    );
  }

  if (res.status === 401) {
    throw new ChatgptAutoError("CHATGPT_AUTO_API_KEY inválida ou ausente");
  }
  if (!res.ok) {
    const text = await res.text();
    throw new ChatgptAutoError(
      `ChatGPT Auto rejeitou o job (${res.status})`,
      text.slice(0, 300)
    );
  }

  const data = (await res.json()) as { jobId?: string };
  if (!data.jobId) {
    throw new ChatgptAutoError("Resposta sem jobId", data);
  }
  return data.jobId;
}

export async function getJob(jobId: string): Promise<ChatgptAutoJob> {
  const url = `${baseUrl()}/api/jobs/${jobId}`;
  let res: Response;
  try {
    res = await fetch(url, {
      headers: { Authorization: `Bearer ${getChatgptAutoApiKey()}` },
      cache: "no-store",
    });
  } catch (err) {
    throw new ChatgptAutoError(
      `ChatGPT Auto inacessível em ${url}: ${
        err instanceof Error ? err.message : String(err)
      }`,
      { url }
    );
  }
  if (!res.ok) {
    throw new ChatgptAutoError(`Consulta do job falhou (${res.status})`);
  }
  return (await res.json()) as ChatgptAutoJob;
}

/**
 * Baixa a primeira imagem do job.
 *
 * A `url` que vem no job é RELATIVA ("/api/jobs/.../images/..."), então é
 * montada sobre a base configurada. Diferente do G-Labs, este download exige
 * o header de autorização.
 */
export async function downloadResult(
  job: ChatgptAutoJob
): Promise<{ buffer: Buffer; filename: string }> {
  const img = job.images?.[0];
  if (!img) throw new ChatgptAutoError("Job concluído sem imagem");

  const url = img.url.startsWith("http")
    ? img.url
    : `${baseUrl()}${img.url.startsWith("/") ? "" : "/"}${img.url}`;

  let res: Response;
  try {
    res = await fetch(url, {
      headers: { Authorization: `Bearer ${getChatgptAutoApiKey()}` },
      cache: "no-store",
    });
  } catch (err) {
    throw new ChatgptAutoError(
      `Não foi possível baixar o resultado em ${url}: ${
        err instanceof Error ? err.message : String(err)
      }`,
      { url }
    );
  }
  if (!res.ok) {
    throw new ChatgptAutoError(`Download falhou (${res.status}) em ${url}`);
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  return { buffer, filename: img.file || "result.png" };
}

/** Health leve: as contas estão online? Usado para pular o provedor sem custo. */
export async function checkHealth(
  timeoutMs = 4000
): Promise<{ ok: boolean; contasOnline: number }> {
  if (!getChatgptAutoApiKey()) return { ok: false, contasOnline: 0 };
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await fetch(`${baseUrl()}/api/accounts`, {
      headers: { Authorization: `Bearer ${getChatgptAutoApiKey()}` },
      cache: "no-store",
      signal: ac.signal,
    });
    if (!res.ok) return { ok: false, contasOnline: 0 };
    const data = (await res.json()) as {
      accounts?: Record<string, { online?: boolean }>;
    };
    const contasOnline = Object.values(data.accounts ?? {}).filter(
      (a) => a.online
    ).length;
    return { ok: contasOnline > 0, contasOnline };
  } catch {
    return { ok: false, contasOnline: 0 };
  } finally {
    clearTimeout(t);
  }
}
