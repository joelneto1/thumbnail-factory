"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  KeyRound,
  Plus,
  Copy,
  Check,
  Trash2,
  AlertTriangle,
  Terminal,
  ChevronRight,
  Eye,
  FileText,
  Download,
  Loader2,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { API_GROUPS, TOTAL_ENDPOINTS, type Endpoint } from "@/lib/api-catalog";
import { buildApiMarkdown } from "@/lib/api-catalog-markdown";

interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  createdAt: number;
  lastUsedAt: number | null;
  revokedAt: number | null;
}

const METHOD_COLOR: Record<string, string> = {
  GET: "var(--accent-3)",
  POST: "var(--success)",
  PATCH: "#F5B544",
  DELETE: "var(--danger)",
};

function CopyButton({ text, label }: { text: string; label?: string }) {
  const [done, setDone] = React.useState(false);
  return (
    <button
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1800);
        } catch {
          toast.error("O navegador bloqueou a cópia — selecione e copie à mão.");
        }
      }}
      className="flex shrink-0 items-center gap-1 rounded-md border border-[var(--line-2)] bg-[var(--bg-2)] px-2 py-1 font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--ink-3)] transition-colors hover:border-[var(--line-3)] hover:text-[var(--ink)]"
    >
      {done ? <Check className="size-3" /> : <Copy className="size-3" />}
      {done ? "copiado" : label ?? "copiar"}
    </button>
  );
}

function CodeBlock({ code }: { code: string }) {
  return (
    <div className="relative">
      <pre className="overflow-x-auto rounded-md border border-[var(--line-2)] bg-[var(--bg)] p-3 pr-14 font-mono text-[11px] leading-relaxed text-[var(--ink-2)]">
        {code}
      </pre>
      <div className="absolute right-2 top-2">
        <CopyButton text={code} />
      </div>
    </div>
  );
}

function EndpointCard({ ep }: { ep: Endpoint }) {
  const [open, setOpen] = React.useState(false);
  return (
    <div className="overflow-hidden rounded-lg border border-[var(--line-2)] bg-white/[0.02]">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-[var(--bg-2)]"
      >
        <span
          className="w-[52px] shrink-0 font-mono text-[10px] font-bold uppercase tracking-wider"
          style={{ color: METHOD_COLOR[ep.method] }}
        >
          {ep.method}
        </span>
        <code className="shrink-0 font-mono text-[12px] text-[var(--ink)]">
          {ep.path}
        </code>
        <span className="min-w-0 flex-1 truncate text-[12px] text-[var(--ink-3)]">
          {ep.summary}
        </span>
        <ChevronRight
          className={cn(
            "size-3.5 shrink-0 text-[var(--ink-4)] transition-transform",
            open && "rotate-90"
          )}
        />
      </button>

      {open && (
        <div className="space-y-3 border-t border-[var(--line-2)] px-3 py-3">
          {ep.notes && (
            <p className="text-[12px] leading-relaxed text-[var(--ink-2)]">{ep.notes}</p>
          )}

          {ep.params && ep.params.length > 0 && (
            <ParamTable title="Parâmetros de query" rows={ep.params} />
          )}
          {ep.body && ep.body.length > 0 && (
            <ParamTable
              title={ep.multipart ? "Campos (multipart/form-data)" : "Corpo (JSON)"}
              rows={ep.body}
            />
          )}

          <div>
            <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--ink-4)]">
              Resposta
            </p>
            <CodeBlock code={ep.response} />
          </div>

          <div>
            <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--ink-4)]">
              Exemplo
            </p>
            <CodeBlock code={ep.curl} />
          </div>
        </div>
      )}
    </div>
  );
}

function ParamTable({
  title,
  rows,
}: {
  title: string;
  rows: Array<{ name: string; type: string; required: boolean; description: string }>;
}) {
  return (
    <div>
      <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--ink-4)]">
        {title}
      </p>
      <div className="overflow-x-auto rounded-md border border-[var(--line-2)]">
        <table className="w-full border-collapse text-[11.5px]">
          <tbody>
            {rows.map((r) => (
              <tr key={r.name} className="border-b border-[var(--line-2)] last:border-b-0">
                <td className="whitespace-nowrap px-2.5 py-1.5 align-top font-mono text-[var(--ink)]">
                  {r.name}
                  {r.required && <span className="text-[var(--danger)]"> *</span>}
                </td>
                <td className="whitespace-nowrap px-2.5 py-1.5 align-top font-mono text-[10.5px] text-[var(--ink-4)]">
                  {r.type}
                </td>
                <td className="px-2.5 py-1.5 align-top text-[var(--ink-3)]">
                  {r.description}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function ApiDocsPage() {
  const qc = useQueryClient();
  const [name, setName] = React.useState("");
  const [novaChave, setNovaChave] = React.useState<string | null>(null);
  const [revogar, setRevogar] = React.useState<ApiKey | null>(null);
  const [mdCopiado, setMdCopiado] = React.useState(false);
  /** Chaves reveladas nesta sessão de tela, por id. */
  const [reveladas, setReveladas] = React.useState<Record<string, string>>({});
  const [revelando, setRevelando] = React.useState<string | null>(null);

  async function copiarMarkdown() {
    try {
      await navigator.clipboard.writeText(buildApiMarkdown(window.location.origin));
      setMdCopiado(true);
      setTimeout(() => setMdCopiado(false), 2000);
      toast.success("Documentação copiada em Markdown");
    } catch {
      toast.error("O navegador bloqueou a cópia — use o botão de baixar.");
    }
  }

  function baixarMarkdown() {
    const blob = new Blob([buildApiMarkdown(window.location.origin)], {
      type: "text/markdown;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "thumbfast-api.md";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function revelar(k: ApiKey) {
    setRevelando(k.id);
    try {
      const r = await fetch(`/api/api-keys/${k.id}/reveal`);
      const j = await r.json().catch(() => null);
      if (!r.ok) throw new Error(j?.error ?? "Não foi possível revelar a chave");
      setReveladas((prev) => ({ ...prev, [k.id]: j.plaintext }));
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setRevelando(null);
    }
  }

  const { data, isLoading } = useQuery<{ keys: ApiKey[] }>({
    queryKey: ["api-keys"],
    queryFn: async () => {
      const r = await fetch("/api/api-keys", { cache: "no-store" });
      if (!r.ok) throw new Error("Falha ao carregar as chaves");
      return r.json();
    },
  });

  const criar = useMutation({
    mutationFn: async (nome: string) => {
      const r = await fetch("/api/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: nome }),
      });
      const j = await r.json().catch(() => null);
      if (!r.ok) throw new Error(j?.error ?? "Falha ao criar a chave");
      return j as { plaintext: string };
    },
    onSuccess: (j) => {
      setNovaChave(j.plaintext);
      setName("");
      qc.invalidateQueries({ queryKey: ["api-keys"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const revogarMut = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/api-keys/${id}`, { method: "DELETE" });
      if (!r.ok) throw new Error("Falha ao revogar");
      return r.json();
    },
    onSuccess: () => {
      toast.success("Chave revogada");
      qc.invalidateQueries({ queryKey: ["api-keys"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const ativas = (data?.keys ?? []).filter((k) => !k.revokedAt);
  const revogadas = (data?.keys ?? []).filter((k) => k.revokedAt);

  return (
    <div className="mx-auto w-full max-w-[1000px] px-6 py-8">
      <header className="mb-6 flex flex-wrap items-center gap-2.5">
        <Terminal className="size-5 text-[var(--accent)]" />
        <h1 className="text-[22px] font-semibold text-[var(--ink)]">API</h1>
        <span className="font-mono text-[11px] text-[var(--ink-4)]">
          {TOTAL_ENDPOINTS} endpoints
        </span>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={copiarMarkdown}>
            {mdCopiado ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
            {mdCopiado ? "copiado" : "Copiar .md"}
          </Button>
          <Button variant="outline" size="sm" onClick={baixarMarkdown}>
            <Download className="size-3.5" />
            Baixar .md
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open("/api-docs/print", "_blank", "noopener")}
          >
            <FileText className="size-3.5" />
            Gerar PDF
          </Button>
        </div>
      </header>

      {/* ─── Autenticação ─────────────────────────────────────────── */}
      <section className="mb-8 rounded-xl border border-[var(--line)] bg-[var(--bg-1)] p-4">
        <h2 className="mb-2 text-[15px] font-semibold text-[var(--ink)]">
          Autenticação
        </h2>
        <p className="mb-3 text-[12.5px] leading-relaxed text-[var(--ink-2)]">
          Todo endpoint aceita o header{" "}
          <code className="rounded bg-[var(--bg-3)] px-1 font-mono text-[11.5px] text-[var(--accent)]">
            X-API-Key
          </code>
          . A chave tem os mesmos poderes do seu login — inclusive apagar personas e
          alterar configurações. Trate-a como senha.
        </p>
        <CodeBlock
          code={`curl -H "X-API-Key: tf_live_..." \\
  https://thumbnail-factory.rotaclubs.com/api/personas`}
        />
        <p className="mt-2 text-[11.5px] leading-relaxed text-[var(--ink-3)]">
          Sem credencial, a resposta é <b>401</b>. A única exceção é{" "}
          <code className="font-mono">/api/health</code>, que responde sem
          autenticação — mas só com <code className="font-mono">{`{"status":"ok"}`}</code>.
        </p>
      </section>

      {/* ─── Chaves ───────────────────────────────────────────────── */}
      <section className="mb-8 rounded-xl border border-[var(--line)] bg-[var(--bg-1)] p-4">
        <h2 className="mb-1 flex items-center gap-2 text-[15px] font-semibold text-[var(--ink)]">
          <KeyRound className="size-4 text-[var(--accent)]" />
          Chaves
        </h2>
        <p className="mb-3 text-[12px] text-[var(--ink-3)]">
          Dê um nome que identifique o sistema — a lista mostra o último uso, que é
          como você percebe uma chave esquecida.
        </p>

        <div className="mb-4 flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && name.trim()) criar.mutate(name.trim());
            }}
            placeholder="Nome do sistema — ex: Hermes Agent"
            maxLength={60}
            className="flex-1 rounded-lg border border-[var(--line-2)] bg-[var(--bg-2)] px-3 py-2 text-[13px] text-[var(--ink)] outline-none placeholder:text-[var(--ink-4)] focus:border-[var(--line-3)]"
          />
          <Button
            onClick={() => name.trim() && criar.mutate(name.trim())}
            disabled={!name.trim() || criar.isPending}
          >
            <Plus className="size-3.5" />
            Gerar chave
          </Button>
        </div>

        {novaChave && (
          <div className="mb-4 rounded-lg border border-[var(--accent)]/40 bg-[var(--accent)]/5 p-3">
            <p className="mb-2 flex items-center gap-1.5 text-[12px] font-semibold text-[var(--accent)]">
              <AlertTriangle className="size-3.5" />
              Copie agora — esta chave não será exibida de novo
            </p>
            <div className="flex items-center gap-2">
              <code className="min-w-0 flex-1 overflow-x-auto rounded-md border border-[var(--line-2)] bg-[var(--bg)] px-2.5 py-2 font-mono text-[12px] text-[var(--ink)]">
                {novaChave}
              </code>
              <CopyButton text={novaChave} label="copiar chave" />
            </div>
            <button
              onClick={() => setNovaChave(null)}
              className="mt-2 font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--ink-4)] hover:text-[var(--ink-2)]"
            >
              já guardei, ocultar
            </button>
          </div>
        )}

        {isLoading ? (
          <p className="py-4 text-center text-[12px] text-[var(--ink-4)]">Carregando…</p>
        ) : ativas.length === 0 && revogadas.length === 0 ? (
          <p className="rounded-md border border-dashed border-[var(--line-2)] py-4 text-center text-[11px] uppercase tracking-[0.12em] text-[var(--ink-4)]">
            Nenhuma chave criada
          </p>
        ) : (
          <ul className="space-y-1.5">
            {[...ativas, ...revogadas].map((k) => (
              <li
                key={k.id}
                className={cn(
                  "flex items-center gap-3 rounded-lg border border-[var(--line-2)] bg-[var(--bg-2)] px-3 py-2",
                  k.revokedAt && "opacity-50"
                )}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium text-[var(--ink)]">
                    {k.name}
                    {k.revokedAt && (
                      <span className="ml-2 font-mono text-[10px] uppercase tracking-wider text-[var(--danger)]">
                        revogada
                      </span>
                    )}
                  </p>
                  <p className="font-mono text-[10.5px] text-[var(--ink-4)]">
                    {/* Revelada: mostra mascarada, mas o botão copia inteira. */}
                    {reveladas[k.id]
                      ? `${reveladas[k.id].slice(0, 14)}${"•".repeat(12)}${reveladas[
                          k.id
                        ].slice(-4)}`
                      : `${k.prefix}…`}
                    &nbsp; criada {formatDate(k.createdAt)}
                    {k.lastUsedAt
                      ? ` · último uso ${formatDate(k.lastUsedAt)}`
                      : " · nunca usada"}
                  </p>
                </div>

                {!k.revokedAt &&
                  (reveladas[k.id] ? (
                    <CopyButton text={reveladas[k.id]} label="copiar chave" />
                  ) : (
                    <button
                      onClick={() => revelar(k)}
                      disabled={revelando === k.id}
                      title="Mostrar para copiar de novo"
                      className="flex shrink-0 items-center gap-1 rounded-md border border-[var(--line-2)] bg-[var(--bg-3)] px-2 py-1 font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--ink-3)] transition-colors hover:border-[var(--line-3)] hover:text-[var(--ink)] disabled:opacity-50"
                    >
                      {revelando === k.id ? (
                        <Loader2 className="size-3 animate-spin" />
                      ) : (
                        <Eye className="size-3" />
                      )}
                      revelar
                    </button>
                  ))}

                {!k.revokedAt && (
                  <button
                    onClick={() => setRevogar(k)}
                    title="Revogar"
                    className="grid size-7 shrink-0 place-items-center rounded text-[var(--ink-3)] hover:bg-[var(--danger)]/10 hover:text-[var(--danger)]"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ─── Endpoints ────────────────────────────────────────────── */}
      {API_GROUPS.map((g) => (
        <section key={g.id} className="mb-8">
          <h2 className="text-[15px] font-semibold text-[var(--ink)]">{g.title}</h2>
          <p className="mb-3 text-[12px] leading-relaxed text-[var(--ink-3)]">
            {g.description}
          </p>
          <div className="space-y-1.5">
            {g.endpoints.map((ep) => (
              <EndpointCard key={`${ep.method} ${ep.path}`} ep={ep} />
            ))}
          </div>
        </section>
      ))}

      <ConfirmDialog
        open={!!revogar}
        onOpenChange={(o) => !o && setRevogar(null)}
        title={`Revogar "${revogar?.name}"?`}
        description="A chave para de funcionar imediatamente e não há como reativá-la. Qualquer sistema que a esteja usando passa a receber 401."
        confirmLabel="Revogar"
        destructive
        onConfirm={() => {
          if (revogar) revogarMut.mutate(revogar.id);
          setRevogar(null);
        }}
      />
    </div>
  );
}
