"use client";

import Link from "next/link";
import { Check, ChevronsUpDown, Plus, UserCircle2 } from "lucide-react";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { fileUrl } from "@/lib/format";
import type { Persona } from "@/lib/types";

export function PersonaPicker({
  personas,
  selectedId,
  onSelect,
}: {
  personas: Persona[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const selected = personas.find((p) => p.id === selectedId) ?? null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "group flex w-full items-center justify-between gap-3 rounded-lg border border-border/60 bg-card p-3 text-left transition-all hover:border-border-strong hover:bg-card-elevated",
            "focus-visible:border-primary/40 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30"
          )}
        >
          <div className="flex items-center gap-3 overflow-hidden">
            {selected?.facePath ? (
              <span className="relative shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={fileUrl(selected.facePath)}
                  alt={selected.name}
                  className="size-11 rounded-md object-cover"
                />
                <span className="absolute -inset-px rounded-md ring-1 ring-border" />
              </span>
            ) : (
              <span className="grid size-11 shrink-0 place-items-center rounded-md bg-secondary text-muted-foreground">
                <UserCircle2 className="size-5" />
              </span>
            )}
            <div className="overflow-hidden text-left">
              <p className="truncate font-display text-base leading-tight">
                {selected?.name ?? "Select persona"}
              </p>
              <p className="truncate text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                {selected
                  ? selected.channel ?? "no channel"
                  : `${personas.length} available`}
              </p>
            </div>
          </div>
          <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:scale-110" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-(--radix-popover-trigger-width) max-h-80 overflow-y-auto p-1 scrollbar-thin"
        align="start"
      >
        {personas.length === 0 ? (
          <div className="space-y-3 p-4 text-center">
            <p className="font-display text-sm italic text-muted-foreground">
              You don&rsquo;t have personas yet
            </p>
            <Link
              href="/personas"
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="size-3.5" /> Create first
            </Link>
          </div>
        ) : (
          <div className="space-y-0.5">
            {personas.map((p) => (
              <button
                key={p.id}
                onClick={() => onSelect(p.id)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-sm p-2 text-left text-sm hover:bg-accent",
                  selectedId === p.id && "bg-accent/60"
                )}
              >
                {p.facePath ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={fileUrl(p.facePath)}
                    alt={p.name}
                    className="size-8 shrink-0 rounded-md object-cover"
                  />
                ) : (
                  <span className="grid size-8 shrink-0 place-items-center rounded-md bg-secondary text-muted-foreground">
                    <UserCircle2 className="size-4" />
                  </span>
                )}
                <div className="flex-1 overflow-hidden">
                  <p className="truncate font-medium">{p.name}</p>
                  <p className="truncate text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                    {p.channel ?? "—"}
                  </p>
                </div>
                {selectedId === p.id && (
                  <Check className="size-4 text-primary" />
                )}
              </button>
            ))}
            <Link
              href="/personas"
              className="flex w-full items-center gap-2 rounded-sm border-t border-border/40 p-2 text-[11px] uppercase tracking-[0.14em] text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <Plus className="size-3.5" /> Manage personas
            </Link>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
