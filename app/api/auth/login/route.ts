import { NextResponse } from "next/server";
import { z } from "zod";

import { verifyPassword } from "@/lib/auth/password";
import {
  SESSION_COOKIE,
  createSessionToken,
  isAuthConfigured,
  sessionCookieOptions,
} from "@/lib/auth/session";
import {
  checkRateLimit,
  clearAttempts,
  clientKey,
  recordFailure,
} from "@/lib/auth/rate-limit";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  username: z.string().min(1).max(200),
  password: z.string().min(1).max(500),
});

/** Hash descartável só pra gastar o mesmo tempo quando o usuário não confere. */
const DUMMY_HASH =
  "scrypt:00000000000000000000000000000000:" + "0".repeat(128);

export async function POST(req: Request) {
  if (!isAuthConfigured()) {
    return NextResponse.json(
      {
        error:
          "Autenticação não configurada no servidor. Faltam AUTH_USERNAME, AUTH_PASSWORD_HASH ou AUTH_SECRET.",
      },
      { status: 503 }
    );
  }

  const key = clientKey(req);
  const limit = checkRateLimit(key);
  if (!limit.allowed) {
    logger.warn("auth", `Login bloqueado por excesso de tentativas (${key})`, {
      detail: { ip: key, liberaEmSegundos: limit.retryAfter },
    });
    return NextResponse.json(
      {
        error: `Muitas tentativas. Tente novamente em ${Math.ceil(
          limit.retryAfter / 60
        )} min.`,
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(limit.retryAfter),
          "Cache-Control": "no-store",
        },
      }
    );
  }

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await req.json());
  } catch {
    recordFailure(key);
    return NextResponse.json({ error: "Requisição inválida." }, { status: 400 });
  }

  const expectedUser = process.env.AUTH_USERNAME ?? "";
  const storedHash = process.env.AUTH_PASSWORD_HASH ?? "";

  const userOk = body.username === expectedUser;
  // Roda o scrypt mesmo com usuário errado: se só rodasse no caminho certo, o
  // tempo de resposta revelaria qual usuário existe.
  const passOk = verifyPassword(body.password, userOk ? storedHash : DUMMY_HASH);

  if (!userOk || !passOk) {
    recordFailure(key);
    // Não registra a senha tentada — nem no log local. Só o que falhou.
    logger.warn("auth", `Login recusado (${key})`, {
      detail: { ip: key, usuarioInformado: body.username, campo: userOk ? "senha" : "usuário" },
    });
    return NextResponse.json(
      { error: "Usuário ou senha incorretos." },
      { status: 401, headers: { "Cache-Control": "no-store" } }
    );
  }

  clearAttempts(key);
  logger.info("auth", `Login efetuado (${body.username})`, {
    detail: { ip: key },
  });

  const token = await createSessionToken(body.username);
  const response = NextResponse.json(
    { ok: true },
    { headers: { "Cache-Control": "no-store" } }
  );
  response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
  return response;
}
