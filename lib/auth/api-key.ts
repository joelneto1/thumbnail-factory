import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

import { apiKeysRepo, type ApiKey } from "../db";

/**
 * Chaves de API para consumo externo (Hermes Agent, n8n, scripts).
 *
 * O banco guarda apenas o SHA-256 da chave. O texto puro existe uma única vez,
 * no instante da criação — nem o app nem quem ler o banco conseguem recuperá-lo
 * depois. Perdeu, gera outra.
 *
 * SHA-256 sem salt é adequado AQUI (e não seria para senha): a chave tem 128
 * bits de entropia aleatória, então não há dicionário nem rainbow table a
 * temer. O que se ganha é lookup direto por hash, que uma função lenta como
 * scrypt inviabilizaria a cada requisição.
 */

const PREFIX = "tf_live_";
const SECRET_BYTES = 16; // 128 bits

export function generateApiKey(): { plaintext: string; hash: string; prefix: string } {
  const plaintext = PREFIX + randomBytes(SECRET_BYTES).toString("hex");
  return {
    plaintext,
    hash: hashApiKey(plaintext),
    // Suficiente para casar visualmente com o sistema, curto demais para servir.
    prefix: plaintext.slice(0, PREFIX.length + 6),
  };
}

export function hashApiKey(plaintext: string): string {
  return createHash("sha256").update(plaintext, "utf8").digest("hex");
}

/** Formato plausível — barra lixo antes de tocar o banco. */
export function looksLikeApiKey(value: string): boolean {
  return new RegExp(`^${PREFIX}[0-9a-f]{${SECRET_BYTES * 2}}$`).test(value);
}

/**
 * Resolve o header `X-API-Key`. Retorna a chave ativa ou null.
 *
 * Marca o último uso, que é o dado que denuncia chave esquecida ou vazada.
 */
export function verifyApiKey(raw: string | null | undefined): ApiKey | null {
  if (!raw || !looksLikeApiKey(raw)) return null;

  const candidate = hashApiKey(raw);
  const found = apiKeysRepo.findActiveByHash(candidate);
  if (!found) return null;

  // O SELECT já casou por igualdade; a comparação em tempo constante aqui é
  // barata e evita depender do comportamento de timing do SQLite.
  const a = Buffer.from(candidate, "hex");
  const b = Buffer.from(hashApiKey(raw), "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  apiKeysRepo.touchLastUsed(found.id);
  return found;
}
