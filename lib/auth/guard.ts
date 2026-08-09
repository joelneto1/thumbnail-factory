import { cookies, headers } from "next/headers";
import { NextResponse } from "next/server";

import { SESSION_COOKIE, verifySessionToken, type SessionPayload } from "./session";
import { verifyApiKey } from "./api-key";

/**
 * Guarda das rotas de API.
 *
 * Duas formas de autenticar, com o mesmo poder:
 *   - cookie de sessão  → a pessoa usando a interface
 *   - header X-API-Key  → sistema externo (Hermes Agent, n8n, scripts)
 *
 * O `proxy.ts` já barra requisições sem nenhuma das duas, mas a doc do Next é
 * clara quanto a Proxy ser verificação otimista, não a camada de autorização —
 * e middleware já teve bypass por header (CVE-2025-29927). Então cada rota
 * revalida por conta própria. Se o proxy for contornado, isto barra.
 */

export type Principal =
  | { kind: "session"; user: string }
  | { kind: "apiKey"; keyId: string; keyName: string };

export async function getPrincipal(): Promise<Principal | null> {
  // Chave primeiro: é o caminho de sistema externo, que não carrega cookie.
  const headerStore = await headers();
  const apiKey = verifyApiKey(headerStore.get("x-api-key"));
  if (apiKey) {
    return { kind: "apiKey", keyId: apiKey.id, keyName: apiKey.name };
  }

  const store = await cookies();
  const session = await verifySessionToken(store.get(SESSION_COOKIE)?.value);
  if (session) return { kind: "session", user: session.sub };

  return null;
}

/** Mantida para o /api/health, que decide o payload conforme haja ou não sessão. */
export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  return verifySessionToken(store.get(SESSION_COOKIE)?.value);
}

/**
 * Uso nas rotas:
 *
 *   const denied = await requireSession();
 *   if (denied) return denied;
 *
 * Retorna a resposta 401 quando não há credencial válida, ou null quando está
 * liberado. O nome permaneceu por compatibilidade com as 27 chamadas
 * existentes — hoje ele aceita sessão OU chave de API.
 */
export async function requireSession(): Promise<NextResponse | null> {
  const principal = await getPrincipal();
  if (principal) return null;
  return NextResponse.json(
    { error: "Não autenticado. Use o cookie de sessão ou o header X-API-Key." },
    { status: 401, headers: { "Cache-Control": "no-store" } }
  );
}
