"use client";

import Link from "next/link";
import { ImageIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { fileUrl, formatRelative } from "@/lib/format";
import type { Persona } from "@/lib/types";

export function PersonaCard({
  persona,
  index,
  className,
}: {
  persona: Persona;
  index?: number;
  className?: string;
}) {
  return (
    <Link
      href={`/personas/${persona.id}`}
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-xl border border-[var(--line-2)] bg-[var(--bg-2)] transition-all duration-300 hover:-translate-y-1 hover:border-[var(--accent)]/40 hover:shadow-[0_18px_48px_-16px_rgba(198,242,78,0.18)]",
        className
      )}
    >
      <div className="relative aspect-[4/5] overflow-hidden bg-[var(--bg-3)]">
        {persona.facePath ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={fileUrl(persona.facePath)}
            alt={persona.name}
            className="size-full object-cover transition-all duration-500 group-hover:scale-[1.04]"
          />
        ) : (
          <div className="flex size-full flex-col items-center justify-center gap-2 text-[var(--ink-4)]">
            <ImageIcon className="size-8" />
            <span className="font-mono text-[10px] uppercase tracking-[0.18em]">
              No face
            </span>
          </div>
        )}

        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-[var(--bg-2)] via-[var(--bg-2)]/40 to-transparent" />

        {index !== undefined && (
          <span className="absolute left-3 top-3 font-mono text-[10px] tracking-[0.18em] text-white/80 mix-blend-difference">
            {String(index).padStart(2, "0")}
          </span>
        )}

        <div className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full border border-[var(--line-2)] bg-black/70 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em] text-[var(--ink-2)] backdrop-blur">
          {persona.stylePaths.length} styles
        </div>
      </div>

      <div className="space-y-1 p-4">
        <p className="display truncate text-base font-semibold leading-tight text-[var(--ink)]">
          {persona.name}
        </p>
        <p className="flex items-center gap-1 truncate font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--ink-3)]">
          <span className="truncate">{persona.channel ?? "—"}</span>
          <span>·</span>
          <span className="truncate">{formatRelative(persona.lastUsedAt)}</span>
        </p>
      </div>
    </Link>
  );
}
