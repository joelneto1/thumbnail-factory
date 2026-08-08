import { SignJWT, jwtVerify } from "jose";

/**
 * Sessão stateless: JWT HS256 em cookie httpOnly.
 *
 * Este módulo é PURO de propósito — não importa `next/headers`, porque ele
 * também roda dentro do `proxy.ts`, onde aquela API não existe. Os helpers de
 * cookie que dependem de `next/headers` ficam em `lib/auth/guard.ts`.
 */

export const SESSION_COOKIE = "tf_session";

/** 7 dias. */
export const SESSION_MAX_AGE = 7 * 24 * 60 * 60;

/** Renova o token quando falta menos que isto para expirar (6 dias). */
const REFRESH_THRESHOLD = 6 * 24 * 60 * 60;

export interface SessionPayload {
  /** Usuário autenticado. */
  sub: string;
  /** Emissão (epoch em segundos), preenchido pelo jose. */
  iat?: number;
  /** Expiração (epoch em segundos), preenchido pelo jose. */
  exp?: number;
}

/**
 * Lê o segredo só na hora de usar — nunca no carregamento do módulo. Se isto
 * lançasse no import, um `AUTH_SECRET` ausente derrubaria o processo inteiro
 * no boot em vez de apenas negar login.
 */
function secretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "AUTH_SECRET ausente ou curto demais (mínimo 32 caracteres)."
    );
  }
  return new TextEncoder().encode(secret);
}

/** true quando as três variáveis de auth estão presentes. */
export function isAuthConfigured(): boolean {
  const { AUTH_USERNAME, AUTH_PASSWORD_HASH, AUTH_SECRET } = process.env;
  return Boolean(
    AUTH_USERNAME && AUTH_PASSWORD_HASH && AUTH_SECRET && AUTH_SECRET.length >= 32
  );
}

export async function createSessionToken(username: string): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(username)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(secretKey());
}

/** Retorna o payload, ou null se o token for inválido, expirado ou ausente. */
export async function verifySessionToken(
  token: string | undefined
): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), {
      algorithms: ["HS256"],
    });
    if (typeof payload.sub !== "string" || !payload.sub) return null;
    return payload as SessionPayload;
  } catch {
    // Assinatura inválida, expirado, malformado, ou AUTH_SECRET ausente.
    // Em todos os casos: sem sessão. Falha fechada.
    return null;
  }
}

/** true quando vale a pena reemitir o token para estender a sessão. */
export function shouldRefresh(payload: SessionPayload): boolean {
  if (!payload.exp) return false;
  const remaining = payload.exp - Math.floor(Date.now() / 1000);
  return remaining < REFRESH_THRESHOLD;
}

/** Opções do cookie de sessão. `secure` cai fora em dev (http://localhost). */
export function sessionCookieOptions(maxAge: number = SESSION_MAX_AGE) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}
