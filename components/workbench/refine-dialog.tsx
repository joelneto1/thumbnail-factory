"use client";

import * as React from "react";
import { Loader2, Wand2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { fileUrl } from "@/lib/format";
import type { GenerationVariant } from "@/lib/types";

export function RefineDialog({
  variant,
  open,
  onOpenChange,
  onSubmit,
  loading,
}: {
  variant: GenerationVariant | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSubmit: (instructions: string) => void;
  loading: boolean;
}) {
  const [instructions, setInstructions] = React.useState("");

  React.useEffect(() => {
    if (!open) setInstructions("");
  }, [open]);

  const submit = () => {
    const trimmed = instructions.trim();
    if (trimmed.length < 3) return;
    onSubmit(trimmed);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (loading && !o) return;
        onOpenChange(o);
      }}
    >
      <DialogContent className="sm:max-w-[640px]">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[var(--accent)]/15">
              <Wand2 className="size-5" style={{ color: "var(--accent)" }} />
            </span>
            <div>
              <DialogTitle>Refinar essa thumbnail</DialogTitle>
              <DialogDescription className="text-[12.5px]">
                A imagem abaixo vira a base. Descreva o que quer trocar — o
                modelo preserva o resto e aplica só os ajustes.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {variant?.outputPath && (
          <div className="overflow-hidden rounded-lg border border-[var(--line-3)] bg-[var(--bg-3)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={fileUrl(variant.outputPath)}
              alt="Thumb base do refinamento"
              className="block aspect-video w-full object-cover"
            />
          </div>
        )}

        <textarea
          autoFocus
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
              e.preventDefault();
              submit();
            }
          }}
          placeholder="Ex: aumentar o tamanho do texto, trocar a cor de fundo pra azul, remover a seta vermelha, adicionar um selo de aprovação no canto…"
          className="min-h-[100px] w-full resize-none rounded-lg border border-[var(--line-2)] bg-[var(--bg-3)] p-3 text-[14px] leading-[1.45] text-[var(--ink)] outline-none placeholder:text-[var(--ink-4)] focus:border-[var(--accent)]/50"
        />

        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--ink-4)]">
            ⌘ ↵ pra refinar
          </span>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button
              onClick={submit}
              disabled={loading || instructions.trim().length < 3}
            >
              {loading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Wand2 className="size-4" />
              )}
              Refinar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
