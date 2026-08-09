"use client";

import * as React from "react";
import { toast } from "sonner";
import {
  ChevronRight,
  Plus,
  Type,
  Box,
  Trash2,
  Pencil,
  CheckCircle2,
  Languages,
  Loader2,
} from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { TextSwap, ObjectSwap, SwapAction } from "@/lib/types";

/** Idiomas com atalho direto. Qualquer outro entra por "Outro". */
const LANGUAGES: Array<{ label: string; value: string }> = [
  { label: "PT-BR", value: "Brazilian Portuguese" },
  { label: "Inglês", value: "English (US)" },
  { label: "Espanhol", value: "Spanish" },
  { label: "Italiano", value: "Italian" },
  { label: "Francês", value: "French" },
  { label: "Alemão", value: "German" },
  { label: "Polonês", value: "Polish" },
  { label: "Sueco", value: "Swedish" },
];

/**
 * Barra de adaptação de idioma.
 *
 * Adapta apenas os textos em "Swap" — os marcados como Keep ficam fora de
 * propósito, porque "manter" costuma ser nome de marca ou termo que o usuário
 * quer preservar no original.
 */
function LanguageBar({
  textSwaps,
  onAdapted,
}: {
  textSwaps: TextSwap[];
  onAdapted: (map: Map<string, string>) => void;
}) {
  const [pending, setPending] = React.useState<string | null>(null);
  const [customOpen, setCustomOpen] = React.useState(false);
  const [custom, setCustom] = React.useState("");

  const adaptable = textSwaps.filter(
    (s) => s.action === "replace" && s.original.trim()
  );
  const disabled = adaptable.length === 0 || pending !== null;

  async function adapt(languageValue: string, languageLabel: string) {
    if (adaptable.length === 0) return;
    setPending(languageLabel);
    try {
      const res = await fetch("/api/adapt-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetLanguage: languageValue,
          texts: adaptable.map((s) => ({
            original: s.original,
            position: s.position,
            style: s.style,
          })),
        }),
      });
      const data = (await res.json().catch(() => null)) as
        | { adaptations?: Array<{ original: string; adapted: string }>; error?: string }
        | null;

      if (!res.ok || !data?.adaptations) {
        // Falhou: os campos ficam como estavam. Nunca apagar o que o usuário
        // já tinha por causa de um erro de rede ou do modelo.
        throw new Error(data?.error ?? "Não foi possível adaptar os textos");
      }

      const map = new Map<string, string>();
      for (const a of data.adaptations) {
        if (a.adapted) map.set(a.original, a.adapted);
      }
      if (map.size === 0) throw new Error("O modelo não devolveu nenhum texto");

      onAdapted(map);
      toast.success(
        `${map.size} texto${map.size > 1 ? "s" : ""} adaptado${
          map.size > 1 ? "s" : ""
        } para ${languageLabel}`
      );
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="space-y-2 rounded-lg border border-border/60 bg-card/30 p-2.5">
      <div className="flex items-center gap-2">
        <Languages className="size-3.5 text-primary/70" />
        <span className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
          Adaptar textos para
        </span>
        {adaptable.length > 0 && (
          <span className="ml-auto font-mono text-[10px] text-muted-foreground">
            {adaptable.length} em swap
          </span>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {LANGUAGES.map((l) => (
          <button
            key={l.value}
            onClick={() => adapt(l.value, l.label)}
            disabled={disabled}
            className={cn(
              "flex items-center gap-1 rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors",
              "border-border/60 bg-background/40 text-muted-foreground",
              "hover:border-primary/50 hover:text-foreground",
              "disabled:cursor-not-allowed disabled:opacity-40"
            )}
          >
            {pending === l.label && <Loader2 className="size-3 animate-spin" />}
            {l.label}
          </button>
        ))}

        <button
          onClick={() => setCustomOpen((v) => !v)}
          disabled={disabled}
          className={cn(
            "rounded-md border border-dashed px-2.5 py-1 text-[11px] font-medium transition-colors",
            "border-border/60 bg-background/40 text-muted-foreground",
            "hover:border-primary/50 hover:text-foreground",
            "disabled:cursor-not-allowed disabled:opacity-40"
          )}
        >
          Outro…
        </button>
      </div>

      {customOpen && (
        <div className="flex gap-1.5">
          <Input
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && custom.trim()) {
                e.preventDefault();
                adapt(custom.trim(), custom.trim());
              }
            }}
            placeholder="Ex: Japonês, Holandês, Turco…"
            className="h-8 text-xs"
          />
          <Button
            size="sm"
            onClick={() => custom.trim() && adapt(custom.trim(), custom.trim())}
            disabled={disabled || !custom.trim()}
          >
            {pending === custom.trim() ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              "Adaptar"
            )}
          </Button>
        </div>
      )}

      {adaptable.length === 0 && (
        <p className="text-[10px] leading-relaxed text-muted-foreground">
          Nenhum texto em modo Swap para adaptar. Textos marcados como Keep são
          preservados no idioma original.
        </p>
      )}
    </div>
  );
}

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

        {textSwaps.length > 0 && (
          <LanguageBar
            textSwaps={textSwaps}
            onAdapted={(map) =>
              onTextSwapsChange(
                textSwaps.map((s) =>
                  // Só o que está em Swap e recebeu adaptação muda. Clicar em
                  // outro idioma sobrescreve — é o que permite trocar de ideia.
                  s.action === "replace" && map.has(s.original)
                    ? { ...s, replacement: map.get(s.original)! }
                    : s
                )
              )
            }
          />
        )}

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
