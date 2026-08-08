"use client";

import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Loader2, LockKeyhole } from "lucide-react";

function LoginForm() {
  const params = useSearchParams();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as
          | { error?: string }
          | null;
        setError(data?.error ?? "Não foi possível entrar.");
        setPending(false);
        return;
      }

      // `next` já vem validado pelo proxy; aqui só aceitamos caminho relativo.
      const raw = params.get("next");
      const target = raw && raw.startsWith("/") && !raw.startsWith("//") ? raw : "/";

      // Reload completo em vez de router.push: o cookie acabou de ser gravado e
      // precisa acompanhar a próxima navegação.
      window.location.assign(target);
    } catch {
      setError("Falha de rede. Tente de novo.");
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="username"
          className="text-[12.5px] font-medium text-[var(--ink-3)]"
        >
          Usuário
        </label>
        <input
          id="username"
          name="username"
          autoComplete="username"
          autoFocus
          required
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="rounded-lg border border-[var(--line-2)] bg-[var(--bg-2)] px-3.5 py-2.5 text-[14px] text-[var(--ink)] outline-none transition-colors placeholder:text-[var(--ink-4)] focus:border-[var(--line-3)]"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="password"
          className="text-[12.5px] font-medium text-[var(--ink-3)]"
        >
          Senha
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded-lg border border-[var(--line-2)] bg-[var(--bg-2)] px-3.5 py-2.5 text-[14px] text-[var(--ink)] outline-none transition-colors placeholder:text-[var(--ink-4)] focus:border-[var(--line-3)]"
        />
      </div>

      {error && (
        <p
          role="alert"
          className="rounded-lg border border-[var(--danger)]/30 bg-[var(--danger)]/10 px-3 py-2 text-[12.5px] text-[var(--danger)]"
        >
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="mt-1 flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-[14px] font-semibold transition-opacity disabled:opacity-60"
        style={{ background: "var(--accent)", color: "#050507" }}
      >
        {pending ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            Entrando…
          </>
        ) : (
          "Entrar"
        )}
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-[calc(100dvh-2rem)] items-center justify-center px-6 py-12">
      <div className="w-full max-w-[380px]">
        <div className="mb-8 flex flex-col items-center gap-3">
          <Image
            src="/thumbfast-logo.png"
            alt="ThumbFast"
            width={586}
            height={123}
            unoptimized
            priority
            className="h-11 w-auto"
          />
          <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--ink-4)]">
            <LockKeyhole className="size-3" />
            Acesso restrito
          </p>
        </div>

        <div className="rounded-xl border border-[var(--line)] bg-[var(--bg-1)] p-6">
          <Suspense fallback={null}>
            <LoginForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
