import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { SESSION_COOKIE, verifySessionToken, type SessionPayload } from "./session";

/**
 * Guarda das rotas de API.
 *
 * O `proxy.ts` já barra requisições sem sessão, mas a doc do Next é explícita
 * quanto a Proxy ser um "optimistic check", não a camada de autorização — e
 * middleware já teve bypass por header (CVE-2025-29927). Então cada rota
 * revalida o JWT por conta própria. Se o proxy for contornado, isto barra.
 */

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
 * Retorna a resposta 401 quando não há sessão, ou null quando está liberado.
 */
export async function requireSession(): Promise<NextResponse | null> {
  const session = await getSession();
  if (session) return null;
  return NextResponse.json(
    { error: "Não autenticado" },
    { status: 401, headers: { "Cache-Control": "no-store" } }
  );
}
