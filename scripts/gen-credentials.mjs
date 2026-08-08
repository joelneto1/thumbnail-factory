#!/usr/bin/env node
/**
 * Gera credenciais para as variáveis de ambiente de autenticação.
 *
 *   node scripts/gen-credentials.mjs            # senha aleatória
 *   node scripts/gen-credentials.mjs "minha senha"   # sua própria senha
 *
 * Imprime AUTH_USERNAME, AUTH_PASSWORD_HASH e AUTH_SECRET prontos pra colar
 * no Coolify. O hash usa o mesmo formato de `lib/auth/password.ts`.
 *
 * Nada disso deve ser commitado.
 */

import { scryptSync, randomBytes } from "node:crypto";

const KEY_LENGTH = 64;
const SALT_BYTES = 16;

/** Alfabeto sem caracteres ambíguos (0/O, 1/l/I) — a senha vai ser digitada. */
const ALPHABET = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function randomPassword(length = 24) {
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i += 1) {
    out += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return out;
}

function hashPassword(password) {
  const salt = randomBytes(SALT_BYTES).toString("hex");
  const hash = scryptSync(password, salt, KEY_LENGTH).toString("hex");
  // Separador `:` e não `$`: env loaders e Docker Compose expandem `$NOME`.
  return `scrypt:${salt}:${hash}`;
}

const password = process.argv[2] ?? randomPassword();
const username = process.env.AUTH_USERNAME_DEFAULT ?? "joel";

console.log("\n=== Cole no Coolify → Environment Variables ===\n");
console.log(`AUTH_USERNAME=${username}`);
console.log(`AUTH_PASSWORD_HASH=${hashPassword(password)}`);
console.log(`AUTH_SECRET=${randomBytes(32).toString("hex")}`);
console.log("\n=== Guarde a senha (ela não aparece em lugar nenhum) ===\n");
console.log(`senha: ${password}`);
console.log(
  "\nTrocar AUTH_SECRET invalida todas as sessões abertas. Redeploy necessário.\n"
);
