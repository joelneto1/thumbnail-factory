"use client";

import * as React from "react";
import { toast } from "sonner";
import { Languages, Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";
import type { TextSwap } from "@/lib/types";

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
 * Adapta em bloco os textos detectados na thumbnail para outro idioma.
 *
 * Só toca nos textos em "Swap": os marcados como Keep ficam de fora de
 * propósito, porque "manter" costuma ser nome de marca ou termo que o usuário
 * quer preservar no original.
 */
export function LanguageBar({
  textSwaps,
  setTextSwaps,
}: {
  textSwaps: TextSwap[];
  setTextSwaps: (s: TextSwap[]) => void;
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
        | {
            adaptations?: Array<{ original: string; adapted: string }>;
            error?: string;
          }
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

      // Sobrescreve o que está em Swap — é o que permite trocar de ideia
      // clicando em outro idioma.
      setTextSwaps(
        textSwaps.map((s) =>
          s.action === "replace" && map.has(s.original)
            ? { ...s, replacement: map.get(s.original)! }
            : s
        )
      );
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

  const chipClass = cn(
    "flex items-center gap-1 rounded-md border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.08em] transition-colors",
    "border-[var(--line-2)] bg-white/[0.02] text-[var(--ink-3)]",
    "hover:border-[var(--line-3)] hover:text-[var(--accent)]",
    "disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:text-[var(--ink-3)]"
  );

  return (
    <div className="space-y-1.5 rounded-lg border border-[var(--line-2)] bg-white/[0.02] p-2">
      <div className="flex items-center gap-1.5">
        <Languages className="size-3.5 text-[var(--accent)]" />
        <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--ink-3)]">
          Adaptar textos para
        </span>
        {adaptable.length > 0 && (
          <span className="ml-auto font-mono text-[10px] text-[var(--ink-4)]">
            {adaptable.length} em swap
          </span>
        )}
      </div>

      <div className="flex flex-wrap gap-1">
        {LANGUAGES.map((l) => (
          <button
            key={l.value}
            onClick={() => adapt(l.value, l.label)}
            disabled={disabled}
            className={chipClass}
          >
            {pending === l.label && <Loader2 className="size-3 animate-spin" />}
            {l.label}
          </button>
        ))}
        <button
          onClick={() => setCustomOpen((v) => !v)}
          disabled={disabled}
          className={cn(chipClass, "border-dashed")}
        >
          Outro…
        </button>
      </div>

      {customOpen && (
        <div className="flex gap-1">
          <input
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && custom.trim()) {
                e.preventDefault();
                adapt(custom.trim(), custom.trim());
              }
            }}
            placeholder="Ex: Japonês, Holandês, Turco…"
            className="flex-1 rounded-md border border-[var(--line-2)] bg-[var(--bg-2)] px-2 py-1 text-[12px] text-[var(--ink)] outline-none placeholder:text-[var(--ink-4)] focus:border-[var(--line-3)]"
          />
          <button
            onClick={() => custom.trim() && adapt(custom.trim(), custom.trim())}
            disabled={disabled || !custom.trim()}
            className={chipClass}
          >
            {pending === custom.trim() ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              "Adaptar"
            )}
          </button>
        </div>
      )}

      {adaptable.length === 0 && (
        <p className="text-[10px] leading-relaxed text-[var(--ink-4)]">
          Nenhum texto em modo Swap. Textos em Keep são preservados no idioma
          original.
        </p>
      )}
    </div>
  );
}
