"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ScrollText,
  AlertCircle,
  AlertTriangle,
  Info,
  Search,
  Trash2,
  RefreshCw,
  ChevronDown,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";

type LogLevel = "info" | "warn" | "error";

interface LogEntry {
  id: number;
  ts: number;
  level: LogLevel;
  scope: string;
  message: string;
  detail: string | null;
  generationId: string | null;
  variantId: string | null;
  engine: string | null;
  taskId: string | null;
  errorCode: number | null;
}

interface LogsResponse {
  entries: LogEntry[];
  counts: { total: number; errors: number; warns: number };
  nextCursor: number | null;
}

const LEVEL_STYLE: Record<
  LogLevel,
  { icon: React.ElementType; color: string; label: string }
> = {
  error: { icon: AlertCircle, color: "var(--danger)", label: "ERRO" },
  warn: { icon: AlertTriangle, color: "#F5B544", label: "AVISO" },
  info: { icon: Info, color: "var(--ink-3)", label: "INFO" },
};

function timestamp(ts: number): string {
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)} ${p(d.getHours())}:${p(
    d.getMinutes()
  )}:${p(d.getSeconds())}`;
}

function LogRow({ entry }: { entry: LogEntry }) {
  const [open, setOpen] = React.useState(false);
  const style = LEVEL_STYLE[entry.level];
  const Icon = style.icon;
  const expandable = !!entry.detail;

  const chips = [
    entry.engine,
    entry.errorCode !== null ? `code ${entry.errorCode}` : null,
    entry.taskId ? `task ${entry.taskId}` : null,
    entry.generationId ? `gen ${entry.generationId}` : null,
  ].filter(Boolean) as string[];

  return (
    <div className="border-b border-[var(--line)] last:border-b-0">
      <button
        type="button"
        onClick={() => expandable && setOpen((v) => !v)}
        disabled={!expandable}
        className={cn(
          "flex w-full items-start gap-3 px-4 py-2.5 text-left transition-colors",
          expandable && "hover:bg-[var(--bg-2)]",
          !expandable && "cursor-default"
        )}
      >
        <span className="mt-[3px] font-mono text-[11px] tabular-nums text-[var(--ink-4)]">
          {timestamp(entry.ts)}
        </span>

        <Icon className="mt-[2px] size-3.5 shrink-0" style={{ color: style.color }} />

        <span
          className="mt-[1px] w-[52px] shrink-0 font-mono text-[10px] font-bold uppercase tracking-wider"
          style={{ color: style.color }}
        >
          {style.label}
        </span>

        <span className="mt-[1px] w-[80px] shrink-0 font-mono text-[10px] uppercase tracking-wider text-[var(--ink-4)]">
          {entry.scope}
        </span>

        <span className="min-w-0 flex-1">
          <span className="block text-[13px] leading-snug text-[var(--ink-2)]">
            {entry.message}
          </span>
          {chips.length > 0 && (
            <span className="mt-1 flex flex-wrap gap-1.5">
              {chips.map((c) => (
                <span
                  key={c}
                  className="rounded border border-[var(--line-2)] bg-[var(--bg-2)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--ink-4)]"
                >
                  {c}
                </span>
              ))}
            </span>
          )}
        </span>

        {expandable && (
          <ChevronDown
            className={cn(
              "mt-[2px] size-3.5 shrink-0 text-[var(--ink-4)] transition-transform",
              open && "rotate-180"
            )}
          />
        )}
      </button>

      {open && entry.detail && (
        <pre className="overflow-x-auto border-t border-[var(--line)] bg-[var(--bg)] px-4 py-3 font-mono text-[11px] leading-relaxed text-[var(--ink-3)]">
          {entry.detail}
        </pre>
      )}
    </div>
  );
}

export default function LogsPage() {
  const qc = useQueryClient();
  const [level, setLevel] = React.useState<LogLevel | "all">("all");
  const [search, setSearch] = React.useState("");
  const [debounced, setDebounced] = React.useState("");
  const [confirmClear, setConfirmClear] = React.useState(false);

  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const params = new URLSearchParams({ limit: "150" });
  if (level !== "all") params.set("level", level);
  if (debounced) params.set("q", debounced);

  const { data, isLoading, refetch, isFetching } = useQuery<LogsResponse>({
    queryKey: ["logs", level, debounced],
    queryFn: async () => {
      const r = await fetch(`/api/logs?${params}`, { cache: "no-store" });
      if (!r.ok) throw new Error("Falha ao carregar logs");
      return r.json();
    },
    refetchInterval: 5000,
  });

  const clear = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/logs", { method: "DELETE" });
      if (!r.ok) throw new Error("Falha ao limpar");
      return r.json() as Promise<{ deleted: number }>;
    },
    onSuccess: (d) => {
      toast.success(`${d.deleted} entradas apagadas`);
      qc.invalidateQueries({ queryKey: ["logs"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const entries = data?.entries ?? [];
  const counts = data?.counts;

  const filters: Array<{ value: LogLevel | "all"; label: string; count?: number }> = [
    { value: "all", label: "Tudo", count: counts?.total },
    { value: "error", label: "Erros", count: counts?.errors },
    { value: "warn", label: "Avisos", count: counts?.warns },
    { value: "info", label: "Info" },
  ];

  return (
    <div className="mx-auto w-full max-w-[1100px] px-6 py-8">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <ScrollText className="size-5 text-[var(--accent)]" />
          <h1 className="text-[22px] font-semibold text-[var(--ink)]">Logs</h1>
          {counts && (
            <span className="font-mono text-[11px] text-[var(--ink-4)]">
              {counts.total} entradas
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RefreshCw className={cn("size-3.5", isFetching && "animate-spin")} />
            Atualizar
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setConfirmClear(true)}
            disabled={!counts?.total}
          >
            <Trash2 className="size-3.5" />
            Limpar
          </Button>
        </div>
      </header>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {filters.map((f) => (
          <button
            key={f.value}
            onClick={() => setLevel(f.value)}
            className={cn(
              "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12.5px] transition-colors",
              level === f.value
                ? "border-[var(--line-3)] bg-[var(--bg-3)] text-[var(--ink)]"
                : "border-[var(--line-2)] bg-[var(--bg-2)] text-[var(--ink-3)] hover:text-[var(--ink-2)]"
            )}
          >
            {f.label}
            {f.count !== undefined && f.count > 0 && (
              <span className="font-mono text-[10px] text-[var(--ink-4)]">
                {f.count}
              </span>
            )}
          </button>
        ))}

        <div className="relative ml-auto">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-[var(--ink-4)]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar na mensagem ou no detalhe…"
            className="w-[280px] rounded-lg border border-[var(--line-2)] bg-[var(--bg-2)] py-1.5 pl-8 pr-3 text-[12.5px] text-[var(--ink)] outline-none transition-colors placeholder:text-[var(--ink-4)] focus:border-[var(--line-3)]"
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--bg-1)]">
        {isLoading ? (
          <p className="px-4 py-10 text-center text-[13px] text-[var(--ink-4)]">
            Carregando…
          </p>
        ) : entries.length === 0 ? (
          <EmptyState
            icon={ScrollText}
            title={debounced || level !== "all" ? "Nada encontrado" : "Sem registros ainda"}
            description={
              debounced || level !== "all"
                ? "Nenhuma entrada bate com esse filtro."
                : "Gerações, logins e falhas de engine aparecem aqui conforme acontecem."
            }
          />
        ) : (
          entries.map((e) => <LogRow key={e.id} entry={e} />)
        )}
      </div>

      {data?.nextCursor && (
        <p className="mt-3 text-center font-mono text-[11px] text-[var(--ink-4)]">
          mostrando as {entries.length} mais recentes — refine o filtro para ver
          entradas mais antigas
        </p>
      )}

      <ConfirmDialog
        open={confirmClear}
        onOpenChange={setConfirmClear}
        title="Limpar todos os logs?"
        description="Apaga a trilha inteira. A própria limpeza fica registrada como primeira entrada nova."
        confirmLabel="Limpar"
        onConfirm={() => {
          clear.mutate();
          setConfirmClear(false);
        }}
      />
    </div>
  );
}
