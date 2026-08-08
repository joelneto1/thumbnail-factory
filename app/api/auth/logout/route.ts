import { NextResponse } from "next/server";

import { SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function POST() {
  const response = NextResponse.json(
    { ok: true },
    { headers: { "Cache-Control": "no-store" } }
  );
  // maxAge 0 apaga o cookie no navegador.
  response.cookies.set(SESSION_COOKIE, "", sessionCookieOptions(0));
  return response;
}
