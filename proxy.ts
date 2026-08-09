import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import {
  SESSION_COOKIE,
  createSessionToken,
  sessionCookieOptions,
  shouldRefresh,
  verifySessionToken,
} from "@/lib/auth/session";

/**
 * Proxy (era `middleware.ts` até o Next 15 — renomeado no 16).
 *
 * Primeira linha de defesa: manda quem não tem sessão pro login e devolve 401
 * nas rotas de API. NÃO é a única barreira — cada rota de API revalida o JWT
 * via `requireSession()`, porque a doc do Next trata Proxy como verificação
 * otimista, não como camada de autorização.
 */

/** Acessíveis sem sessão, por necessidade. */
const PUBLIC_PATHS = new Set([
  "/login",
  "/api/auth/login",
  // O healthcheck do Coolify bate aqui. A própria rota reduz o payload quando
  // não há sessão, então isto não vaza configuração.
  "/api/health",
]);

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.has(pathname);
}

/**
 * Só aceita caminho relativo da própria app. Sem isto, `?next=` viraria um
 * open redirect — alguém mandaria `/login?next=https://site-malicioso` e o
 * usuário sairia do login direto pra lá.
 */
function safeNextPath(raw: string | null): string {
  if (!raw) return "/";
  if (!raw.startsWith("/") || raw.startsWith("//")) return "/";
  return raw;
}

/**
 * Checagem de FORMATO da chave de API, não de validade.
 *
 * A verificação real (existe? está revogada?) exige o banco, e puxar o SQLite
 * para o bundle do proxy seria caro e frágil. Aqui só se decide "parece uma
 * chave, deixa seguir" — quem barra de verdade é o `requireSession()` da rota,
 * que é a camada de autorização de fato.
 */
function looksLikeApiKeyHeader(request: NextRequest): boolean {
  const raw = request.headers.get("x-api-key");
  return !!raw && /^tf_live_[0-9a-f]{32}$/.test(raw);
}

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // Requisição de sistema externo: segue para a rota, que valida a chave.
  if (pathname.startsWith("/api/") && looksLikeApiKeyHeader(request)) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = await verifySessionToken(token);

  // Já logado abrindo /login: manda pro destino pretendido.
  if (session && pathname === "/login") {
    const target = safeNextPath(request.nextUrl.searchParams.get("next"));
    return NextResponse.redirect(new URL(target, request.url));
  }

  if (isPublic(pathname)) {
    return NextResponse.next();
  }

  if (!session) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "Não autenticado" },
        { status: 401, headers: { "Cache-Control": "no-store" } }
      );
    }
    const loginUrl = new URL("/login", request.url);
    // Preserva onde a pessoa queria chegar, pra voltar depois do login.
    if (pathname !== "/") loginUrl.searchParams.set("next", pathname + search);
    return NextResponse.redirect(loginUrl);
  }

  const response = NextResponse.next();

  // Sessão deslizante: renova o token quando já passou tempo suficiente, pra
  // quem usa o app com frequência nunca ser deslogado do nada.
  if (shouldRefresh(session)) {
    try {
      const refreshed = await createSessionToken(session.sub);
      response.cookies.set(SESSION_COOKIE, refreshed, sessionCookieOptions());
    } catch {
      // Falhou renovar: segue com o token atual, que ainda é válido.
    }
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Tudo, menos os estáticos do Next e arquivos com extensão (logo, favicon,
     * manifest) — que a tela de login precisa carregar antes de autenticar.
     * As rotas /api/* ficam DENTRO do matcher de propósito.
     */
    "/((?!_next/static|_next/image|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico|webmanifest|txt|xml)$).*)",
  ],
};
