"use client";

import { useQuery } from "@tanstack/react-query";
import type { Persona } from "@/lib/types";

interface HistoryItem {
  generation: { id: string; createdAt: number; mode?: string };
  completedCount: number;
  variantCount: number;
}

export function Hero({ persona }: { persona: Persona | null }) {
  // Live stats from /api/history (fresh count of total + today)
  const { data } = useQuery<{ items: HistoryItem[] }>({
    queryKey: ["history"],
    queryFn: async () => {
      const r = await fetch("/api/history?limit=200", { cache: "no-store" });
      if (!r.ok) return { items: [] };
      return r.json();
    },
  });

  const items = data?.items ?? [];
  const todayMs = Date.now() - 24 * 60 * 60 * 1000;
  const todayCount = items.filter((it) => it.generation.createdAt > todayMs).length;
  const totalThumbs = items.reduce((acc, it) => acc + it.completedCount, 0);
  const personaName = persona?.name ?? "—";

  return (
    <section className="relative mx-auto flex max-w-[1280px] flex-wrap items-center justify-between gap-4 px-8 pb-3 pt-3">
      <div className="inline-flex items-center gap-3 rounded-full border border-[var(--line-2)] bg-white/5 px-3.5 py-1.5 font-mono text-[11px] tracking-[0.06em] text-[var(--ink-2)] backdrop-blur">
        <span
          className="pulse-dot inline-block size-2 rounded-full"
          style={{
            background: "var(--accent)",
            boxShadow: "0 0 12px var(--accent)",
          }}
        />
        <span>
          Workbench <span className="text-[var(--ink-4)]">·</span>{" "}
          batch <b className="font-semibold text-[var(--ink)]">live</b>
        </span>
        <span className="text-[var(--ink-4)]">/</span>
        <span>
          persona <b className="font-semibold text-[var(--ink)]">{personaName}</b>
        </span>
      </div>

      <div className="inline-flex items-center gap-6 rounded-2xl border border-[var(--line-2)] bg-white/[0.025] px-5 py-2.5 backdrop-blur-md">
        <Stat
          num={
            totalThumbs > 0 ? (
              <span className="text-gradient">{totalThumbs.toLocaleString("pt-BR")}</span>
            ) : (
              <span className="text-[var(--ink-3)]">—</span>
            )
          }
          label="thumbs geradas"
        />
        <Divider />
        <Stat
          num={todayCount > 0 ? todayCount.toLocaleString("pt-BR") : "—"}
          label="últimas 24h"
        />
        <Divider />
        <Stat
          num={items.length > 0 ? items.length.toLocaleString("pt-BR") : "—"}
          label="batches no archive"
        />
      </div>
    </section>
  );
}

function Stat({ num, label }: { num: React.ReactNode; label: string }) {
  return (
    <div className="flex flex-col items-start gap-0.5">
      <span className="display tabular text-[22px] font-bold leading-none tracking-[-0.03em] text-[var(--ink)]">
        {num}
      </span>
      <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--ink-3)]">
        {label}
      </span>
    </div>
  );
}

function Divider() {
  return <span className="h-7 w-px bg-[var(--line-2)]" />;
}
