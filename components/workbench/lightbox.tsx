"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, Download, X, Copy } from "lucide-react";

import { fileUrl } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { GenerationVariant } from "@/lib/types";

export function Lightbox({
  variants,
  index,
  onClose,
  onPrev,
  onNext,
  onDownload,
  onCopyPrompt,
}: {
  variants: GenerationVariant[];
  index: number | null;
  onClose: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  onDownload?: (v: GenerationVariant) => void;
  onCopyPrompt?: () => void;
}) {
  const v = index !== null ? variants[index] : null;

  const isOpen = v !== null;

  React.useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft" && onPrev) onPrev();
      if (e.key === "ArrowRight" && onNext) onNext();
    };
    window.addEventListener("keydown", onKey);
    // lock body scroll while open
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen, onClose, onPrev, onNext]);

  if (!v || typeof document === "undefined") return null;

  const seed = (v.taskId ?? v.id).slice(0, 8).toUpperCase();
  const total = variants.length;

  return createPortal(
    <div
      className="fixed inset-0 z-[110] flex flex-col bg-[rgba(5,5,7,0.95)] backdrop-blur-md"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Head */}
      <header className="flex items-center justify-between gap-4 border-b border-[var(--line)] px-6 py-4">
        <div className="flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--ink-3)]">
          <span>
            Variante{" "}
            <b className="font-semibold" style={{ color: "var(--accent)" }}>
              V{String((index ?? 0) + 1).padStart(2, "0")}
            </b>
          </span>
          <span className="text-[var(--ink-5)]">·</span>
          <span>{v.engineUsed === "glabs" ? "G-LABS" : "GEMINI"}</span>
          <span className="text-[var(--ink-5)]">·</span>
          <span>seed <b className="font-semibold text-[var(--ink-2)]">{seed}</b></span>
        </div>
        <div className="flex items-center gap-1.5">
          {onCopyPrompt && (
            <ToolBtn onClick={onCopyPrompt} icon={<Copy className="size-3.5" />}>
              Copiar prompt
            </ToolBtn>
          )}
          {onDownload && (
            <ToolBtn
              primary
              onClick={() => onDownload(v)}
              icon={<Download className="size-3.5" />}
            >
              Download
            </ToolBtn>
          )}
          <button
            onClick={onClose}
            className="grid size-8 place-items-center rounded-md text-[var(--ink-3)] hover:bg-white/5 hover:text-[var(--ink)]"
            aria-label="Fechar"
          >
            <X className="size-4" />
          </button>
        </div>
      </header>

      {/* Body */}
      <div
        className="relative grid flex-1 place-items-center overflow-hidden p-6"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        {v.outputPath ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={fileUrl(v.outputPath)}
            alt={`Variant ${(index ?? 0) + 1}`}
            className="max-h-[calc(100vh-180px)] max-w-[calc(100vw-80px)] rounded-lg border border-[var(--line-2)] object-contain shadow-[0_24px_80px_rgba(0,0,0,0.7)]"
          />
        ) : (
          <div className="text-[var(--ink-3)]">Sem imagem</div>
        )}

        {onPrev && total > 1 && (
          <button
            onClick={onPrev}
            className="absolute left-4 top-1/2 grid size-12 -translate-y-1/2 place-items-center rounded-full border border-[var(--line-2)] bg-black/60 text-[var(--ink-2)] backdrop-blur transition-all hover:bg-black/85 hover:text-[var(--ink)]"
            aria-label="Anterior"
          >
            <ChevronLeft className="size-5" />
          </button>
        )}
        {onNext && total > 1 && (
          <button
            onClick={onNext}
            className="absolute right-4 top-1/2 grid size-12 -translate-y-1/2 place-items-center rounded-full border border-[var(--line-2)] bg-black/60 text-[var(--ink-2)] backdrop-blur transition-all hover:bg-black/85 hover:text-[var(--ink)]"
            aria-label="Próxima"
          >
            <ChevronRight className="size-5" />
          </button>
        )}
      </div>

      {/* Foot */}
      <footer className="flex items-center justify-between border-t border-[var(--line)] px-6 py-3 font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--ink-3)]">
        <div className="flex items-center gap-3">
          <span className="rounded border border-[var(--line-2)] bg-[var(--bg-3)] px-1.5 py-0.5 text-[var(--ink-2)]">←</span>
          anterior
          <span style={{ width: 8 }} />
          próximo
          <span className="rounded border border-[var(--line-2)] bg-[var(--bg-3)] px-1.5 py-0.5 text-[var(--ink-2)]">→</span>
          <span style={{ width: 8 }} />
          fechar
          <span className="rounded border border-[var(--line-2)] bg-[var(--bg-3)] px-1.5 py-0.5 text-[var(--ink-2)]">esc</span>
        </div>
        <div>
          {(index ?? 0) + 1} / {total}
        </div>
      </footer>
    </div>,
    document.body
  );
}

function ToolBtn({
  children,
  icon,
  onClick,
  primary,
}: {
  children: React.ReactNode;
  icon: React.ReactNode;
  onClick: () => void;
  primary?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-2 rounded-[9px] border px-3 py-1.5 text-[12.5px] font-medium transition-all",
        primary
          ? "border-transparent text-[#050507] cta-shadow"
          : "border-[var(--line-2)] bg-[var(--bg-2)] text-[var(--ink-2)] hover:border-[var(--line-3)] hover:bg-[var(--bg-3)] hover:text-[var(--ink)]"
      )}
      style={primary ? { background: "var(--grad-cta)" } : undefined}
    >
      {icon}
      {children}
    </button>
  );
}
