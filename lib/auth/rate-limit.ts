/**
 * Limite de tentativas de login, em memória.
 *
 * A aplicação roda em instância única (um container no Coolify), então um Map
 * local basta — não vale trazer Redis pra isso. O efeito colateral aceito é
 * que o contador zera a cada redeploy.
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;

const buckets = new Map<string, Bucket>();

/** Remove janelas vencidas para o Map não crescer sem limite. */
function prune(now: number): void {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

export interface RateLimitResult {
  allowed: boolean;
  /** Segundos até liberar. Só faz sentido quando `allowed` é false. */
  retryAfter: number;
}

export function checkRateLimit(key: string): RateLimitResult {
  const now = Date.now();
  prune(now);

  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    return { allowed: true, retryAfter: 0 };
  }
  if (bucket.count < MAX_ATTEMPTS) {
    return { allowed: true, retryAfter: 0 };
  }
  return {
    allowed: false,
    retryAfter: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
  };
}

/** Conta uma tentativa falha. A janela começa na primeira falha. */
export function recordFailure(key: string): void {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return;
  }
  bucket.count += 1;
}

/** Zera o contador após um login bem-sucedido. */
export function clearAttempts(key: string): void {
  buckets.delete(key);
}

/**
 * Identifica o cliente. Atrás do proxy do Coolify (Traefik), o IP real vem no
 * `x-forwarded-for`; o primeiro valor da lista é o cliente original.
 */
export function clientKey(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return req.headers.get("x-real-ip")?.trim() || "desconhecido";
}
