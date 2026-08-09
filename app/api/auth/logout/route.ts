import { NextResponse } from "next/server";

import { SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth/session";
import { logged } from "@/lib/route-logger";

export const dynamic = "force-dynamic";

export const POST = logged("auth", "POST /auth/logout", async function () {
  const response = NextResponse.json(
    { ok: true },
    { headers: { "Cache-Control": "no-store" } }
  );
  // maxAge 0 apaga o cookie no navegador.
  response.cookies.set(SESSION_COOKIE, "", sessionCookieOptions(0));
  return response;
});
