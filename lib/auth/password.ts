import { scryptSync, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Hash de senha com scrypt do próprio Node — de propósito, sem bcrypt/argon2.
 * O Dockerfile já sofre pra compilar o binário nativo do better-sqlite3; não
 * vale a pena adicionar outra dependência nativa só pra isso.
 *
 * Formato: `scrypt:<salt hex>:<hash hex>`
 *
 * O separador é `:` e NÃO `$` de propósito. Tanto o loader de env do Next
 * quanto o Docker Compose expandem `$NOME` como variável — com `$`, o valor
 * `scrypt$abc$def` chega na aplicação como `"scrypt"`, e o login falha sem
 * nenhuma mensagem que indique a causa. Salt e hash são hex, então `:` nunca
 * aparece dentro deles.
 */

const KEY_LENGTH = 64;
const SALT_BYTES = 16;

export function hashPassword(password: string): string {
  const salt = randomBytes(SALT_BYTES).toString("hex");
  const hash = scryptSync(password, salt, KEY_LENGTH).toString("hex");
  return `scrypt:${salt}:${hash}`;
}

/**
 * Compara em tempo constante. Retorna false (nunca lança) se o hash
 * armazenado estiver malformado — senão um `AUTH_PASSWORD_HASH` digitado
 * errado no Coolify viraria erro 500 em vez de um login negado.
 */
export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split(":");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;

  const [, salt, expectedHex] = parts;
  if (!salt || !expectedHex) return false;

  let expected: Buffer;
  try {
    expected = Buffer.from(expectedHex, "hex");
  } catch {
    return false;
  }
  if (expected.length !== KEY_LENGTH) return false;

  const actual = scryptSync(password, salt, KEY_LENGTH);
  return timingSafeEqual(actual, expected);
}
