"use client";

import * as React from "react";
import {
  ChevronRight,
  Plus,
  Type,
  Box,
  Trash2,
  Pencil,
  CheckCircle2,
} from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { TextSwap, ObjectSwap, SwapAction } from "@/lib/types";

function ActionPicker({
  value,
  onChange,
}: {
  value: SwapAction;
  onChange: (a: SwapAction) => void;
}) {
  const items: Array<{ id: SwapAction; label: string; icon: React.ReactNode }> = [
    { id: "replace", label: "Swap", icon: <Pencil className="size-3" /> },
    { id: "keep", label: "Keep", icon: <CheckCircle2 className="size-3" /> },
    { id: "remove", label: "Remove", icon: <Trash2 className="size-3" /> },
  ];
  return (
    <div className="inline-flex rounded-md border border-border/60 bg-background/40 p-0.5 text-[10px] uppercase tracking-[0.12em]">
      {items.map((it) => (
        <button
          key={it.id}
          onClick={() => onChange(it.id)}
          className={cn(
            "flex items-center gap-1 rounded-sm px-2 py-1 font-medium transition-colors",
            value === it.id
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {it.icon}
          {it.label}
        </button>
      ))}
    </div>
  );
}

export function RemodelMode({
  textSwaps,
  objectSwaps,
  onTextSwapsChange,
  onObjectSwapsChange,
  extraInstructions,
  onExtraInstructionsChange,
}: {
  textSwaps: TextSwap[];
  objectSwaps: ObjectSwap[];
  onTextSwapsChange: (swaps: TextSwap[]) => void;
  onObjectSwapsChange: (swaps: ObjectSwap[]) => void;
  extraInstructions: string;
  onExtraInstructionsChange: (s: string) => void;
}) {
  const updateTextSwap = (i: number, patch: Partial<TextSwap>) => {
    const next = textSwaps.map((s, idx) => (idx === i ? { ...s, ...patch } : s));
    onTextSwapsChange(next);
  };
  const updateObjectSwap = (i: number, patch: Partial<ObjectSwap>) => {
    const next = objectSwaps.map((s, idx) =>
      idx === i ? { ...s, ...patch } : s
    );
    onObjectSwapsChange(next);
  };

  const addTextSwap = () => {
    onTextSwapsChange([
      ...textSwaps,
      { original: "", action: "replace", replacement: "" },
    ]);
  };
  const addObjectSwap = () => {
    onObjectSwapsChange([
      ...objectSwaps,
      { original: "", action: "replace", replacement: "" },
    ]);
  };

  const removeTextSwap = (i: number) => {
    onTextSwapsChange(textSwaps.filter((_, idx) => idx !== i));
  };
  const removeObjectSwap = (i: number) => {
    onObjectSwapsChange(objectSwaps.filter((_, idx) => idx !== i));
  };

  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-lg border border-primary/30 bg-primary/5">
        <div className="flex items-baseline gap-3 border-b border-primary/20 px-3 py-2">
          <span className="font-mono text-[9px] tracking-[0.18em] text-primary">●</span>
          <p className="font-display text-sm italic text-primary">
            Remodel mode active
          </p>
        </div>
        <p className="px-3 py-2 text-[11px] leading-relaxed text-foreground/80">
          Layout, paleta e composição vêm do anchor. Você troca apenas texto e
          objetos — cirúrgico.
        </p>
      </div>

      {/* TEXT SWAPS */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            <Type className="size-3.5 text-primary/70" />
            Detected text
          </Label>
          <Button size="sm" variant="ghost" onClick={addTextSwap}>
            <Plus className="size-3.5" /> add
          </Button>
        </div>

        {textSwaps.length === 0 ? (
          <p className="rounded border border-dashed border-border/50 bg-card/30 px-3 py-3 text-center text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            No text detected yet
          </p>
        ) : (
          <ul className="space-y-2">
            {textSwaps.map((s, i) => (
              <li
                key={i}
                className="space-y-2 rounded-lg border border-border/60 bg-card/40 p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <p className="truncate font-display text-sm text-foreground">
                      {s.original || (
                        <span className="italic text-muted-foreground">
                          (sem texto detectado)
                        </span>
                      )}
                    </p>
                    {(s.position || s.style) && (
                      <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                        {[s.position, s.style].filter(Boolean).join(" · ")}
                      </p>
                    )}
                  </div>
                  <ActionPicker
                    value={s.action}
                    onChange={(a) => updateTextSwap(i, { action: a })}
                  />
                  <button
                    onClick={() => removeTextSwap(i)}
                    className="grid size-6 shrink-0 place-items-center rounded text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    aria-label="Apagar item"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>

                {!s.original && (
                  <Input
                    value={s.original}
                    onChange={(e) => updateTextSwap(i, { original: e.target.value })}
                    placeholder="Texto original (ex: 5 SUPERFOODS)"
                    className="h-9 text-xs"
                  />
                )}

                {s.action === "replace" && (
                  <Input
                    value={s.replacement ?? ""}
                    onChange={(e) =>
                      updateTextSwap(i, { replacement: e.target.value.toUpperCase() })
                    }
                    placeholder="Sua versão (ex: 9 SIGNS)"
                    className="h-9 font-medium"
                  />
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* OBJECT SWAPS */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            <Box className="size-3.5 text-primary/70" />
            Detected objects
          </Label>
          <Button size="sm" variant="ghost" onClick={addObjectSwap}>
            <Plus className="size-3.5" /> add
          </Button>
        </div>

        {objectSwaps.length === 0 ? (
          <p className="rounded border border-dashed border-border/50 bg-card/30 px-3 py-3 text-center text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            No object detected yet
          </p>
        ) : (
          <ul className="space-y-2">
            {objectSwaps.map((s, i) => (
              <li
                key={i}
                className="space-y-2 rounded-lg border border-border/60 bg-card/40 p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <p className="truncate font-display text-sm text-foreground">
                      {s.original || (
                        <span className="italic text-muted-foreground">
                          (sem objeto)
                        </span>
                      )}
                    </p>
                    {s.position && (
                      <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                        {s.position}
                      </p>
                    )}
                  </div>
                  <ActionPicker
                    value={s.action}
                    onChange={(a) => updateObjectSwap(i, { action: a })}
                  />
                  <button
                    onClick={() => removeObjectSwap(i)}
                    className="grid size-6 shrink-0 place-items-center rounded text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    aria-label="Apagar item"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>

                {!s.original && (
                  <Input
                    value={s.original}
                    onChange={(e) => updateObjectSwap(i, { original: e.target.value })}
                    placeholder="Objeto original (ex: abacate cortado)"
                    className="h-9 text-xs"
                  />
                )}

                {s.action === "replace" && (
                  <Input
                    value={s.replacement ?? ""}
                    onChange={(e) =>
                      updateObjectSwap(i, { replacement: e.target.value })
                    }
                    placeholder="Sua versão (ex: pé descalço com glucometer)"
                    className="h-9"
                  />
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <details className="group">
        <summary className="flex cursor-pointer items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground">
          <ChevronRight className="size-3 transition-transform group-open:rotate-90" />
          Extra instructions
        </summary>
        <textarea
          value={extraInstructions}
          onChange={(e) => onExtraInstructionsChange(e.target.value)}
          placeholder="Ex: aumentar saturação do amarelo, fazer a face olhar pra esquerda"
          rows={2}
          className="mt-2 w-full resize-none rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30"
        />
      </details>
    </div>
  );
}
