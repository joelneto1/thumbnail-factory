import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";

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

// ─── Cifragem para reexibição ─────────────────────────────────────────
//
// O hash acima continua sendo o que AUTENTICA — ele é irreversível e é o que
// a verificação usa. O que segue existe só para o usuário poder copiar a
// chave de novo se perder, sob sessão do navegador.
//
// AES-256-GCM com chave derivada do AUTH_SECRET: o arquivo do banco sozinho
// (um backup, um volume copiado) não revela nada, porque o segredo vive nas
// variáveis de ambiente. Quem tiver os dois tem tudo — mas aí já tem o
// servidor inteiro.

const CIPHER = "aes-256-gcm";
/** Salt fixo: o segredo já é de alta entropia, e derivar por chave impediria decifrar. */
const KDF_SALT = "thumbfast:api-key:v1";

function cipherKey(): Buffer | null {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) return null;
  return scryptSync(secret, KDF_SALT, 32);
}

/** Retorna null quando não há AUTH_SECRET — a chave simplesmente não fica recuperável. */
export function encryptApiKey(plaintext: string): string | null {
  const key = cipherKey();
  if (!key) return null;
  const iv = randomBytes(12);
  const c = createCipheriv(CIPHER, key, iv);
  const enc = Buffer.concat([c.update(plaintext, "utf8"), c.final()]);
  const tag = c.getAuthTag();
  return `${iv.toString("hex")}:${tag.toString("hex")}:${enc.toString("hex")}`;
}

/** Retorna null se faltar segredo, o formato não bater, ou o AUTH_SECRET tiver mudado. */
export function decryptApiKey(payload: string | null): string | null {
  if (!payload) return null;
  const key = cipherKey();
  if (!key) return null;

  const parts = payload.split(":");
  if (parts.length !== 3) return null;
  const [ivHex, tagHex, dataHex] = parts;

  try {
    const d = createDecipheriv(CIPHER, key, Buffer.from(ivHex, "hex"));
    d.setAuthTag(Buffer.from(tagHex, "hex"));
    return Buffer.concat([
      d.update(Buffer.from(dataHex, "hex")),
      d.final(),
    ]).toString("utf8");
  } catch {
    // Tag inválida = segredo trocado ou dado adulterado. Nos dois casos, some.
    return null;
  }
}

/** Máscara para exibição: mostra as pontas, esconde o miolo. */
export function maskApiKey(plaintext: string): string {
  if (plaintext.length <= 18) return plaintext;
  return `${plaintext.slice(0, 14)}${"•".repeat(12)}${plaintext.slice(-4)}`;
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
