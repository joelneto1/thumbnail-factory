"use client";

import { Users, Plus } from "lucide-react";

import { usePersonas } from "@/lib/hooks/use-personas";
import { PersonaCard } from "@/components/personas/persona-card";
import { CreatePersonaDialog } from "@/components/personas/create-persona-dialog";

export default function PersonasPage() {
  const { data, isLoading } = usePersonas();

  return (
    <div className="mx-auto max-w-[1280px] px-8 py-14">
      <header className="mb-10 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-[var(--ink-3)]">
            Cast · Personas
          </p>
          <h1 className="display text-[clamp(34px,5vw,56px)] font-bold leading-[1] tracking-[-0.02em] text-[var(--ink)]">
            Suas <span className="text-gradient italic">personas</span>
          </h1>
          <p className="max-w-[520px] text-[14px] leading-[1.5] text-[var(--ink-3)]">
            Cada persona é um preset de canal — uma face de referência e style refs que reforçam a estética.
          </p>
        </div>
        <CreatePersonaDialog />
      </header>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="aspect-[4/5] overflow-hidden rounded-xl border border-[var(--line-2)] bg-[var(--bg-2)]"
            >
              <div className="size-full shimmer opacity-30" />
            </div>
          ))}
        </div>
      ) : !data?.personas.length ? (
        <EmptyPersonas />
      ) : (
        <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {data.personas.map((p, i) => (
            <PersonaCard key={p.id} persona={p} index={i + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyPersonas() {
  return (
    <div
      className="relative grid place-items-center overflow-hidden rounded-2xl border border-dashed border-[var(--line-2)] bg-white/[0.02] py-24 text-center"
      style={{ minHeight: 320 }}
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 60% 50% at 50% 30%, rgba(198,242,78,.06), transparent 70%)",
        }}
      />
      <div className="relative space-y-3">
        <div className="mx-auto grid size-14 place-items-center rounded-full border border-[var(--line-2)] bg-[var(--bg-2)] text-[var(--ink-3)]">
          <Users className="size-6" style={{ color: "var(--accent)" }} />
        </div>
        <p className="display text-2xl font-semibold italic text-[var(--ink-2)]">
          Sem personas ainda
        </p>
        <p className="mx-auto max-w-md font-mono text-[11px] uppercase tracking-[0.1em] text-[var(--ink-3)]">
          comece criando seu primeiro preset de canal
        </p>
        <CreatePersonaDialog
          trigger={
            <button
              className="mt-3 inline-flex items-center gap-2 rounded-[9px] px-4 py-2.5 display text-[13px] font-bold text-[#050507]"
              style={{ background: "var(--grad-cta)", boxShadow: "0 6px 18px rgba(198,242,78,.3)" }}
            >
              <Plus className="size-3.5" /> Criar primeira persona
            </button>
          }
        />
      </div>
    </div>
  );
}
