"use client";

import * as React from "react";
import { motion } from "framer-motion";
import {
  Star,
  Download,
  Maximize2,
  Trash2,
  Loader2,
  AlertTriangle,
  BookmarkPlus,
  Wand2,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { fileUrl } from "@/lib/format";
import type { GenerationVariant } from "@/lib/types";

export function ThumbCard({
  variant,
  index,
  isFavorite,
  onZoom,
  onDownload,
  onRefine,
  onUseAsRef,
  onToggleFavorite,
  onRemove,
}: {
  variant: GenerationVariant;
  index: number;
  isFavorite?: boolean;
  onZoom?: (v: GenerationVariant) => void;
  onDownload?: (v: GenerationVariant) => void;
  onRefine?: (v: GenerationVariant) => void;
  onUseAsRef?: (v: GenerationVariant) => void;
  onToggleFavorite?: (v: GenerationVariant) => void;
  onRemove?: (v: GenerationVariant) => void;
}) {
  const isDone = variant.status === "completed";
  const isFailed = variant.status === "failed";
  const stop = (e: React.MouseEvent) => e.stopPropagation();

  const seed = (variant.taskId ?? variant.id).slice(0, 8).toUpperCase();

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        duration: 0.45,
        ease: [0.22, 1, 0.36, 1],
        delay: Math.min(index * 0.06, 0.3),
      }}
      onClick={() => isDone && onZoom?.(variant)}
      role={isDone && onZoom ? "button" : undefined}
      tabIndex={isDone && onZoom ? 0 : undefined}
      onKeyDown={(e) => {
        if (isDone && onZoom && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onZoom(variant);
        }
      }}
      className={cn(
        "group relative aspect-video overflow-hidden rounded-[14px] border border-[var(--line-2)] bg-[var(--bg-2)] transition-all duration-300",
        isDone && "cursor-pointer hover:-translate-y-0.5 hover:border-[var(--line-3)] hover:shadow-[0_18px_48px_-16px_rgba(198,242,78,0.18)]",
        isFavorite && "border-[var(--accent)]"
      )}
    >
      {isDone && variant.outputPath ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={fileUrl(variant.outputPath)}
          alt={`Variant ${index + 1}`}
          className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
        />
      ) : isFailed ? (
        <div className="flex size-full flex-col items-center justify-center gap-2 p-4 text-center">
          <AlertTriangle className="size-6" style={{ color: "var(--danger)" }} />
          <p className="display text-sm font-semibold" style={{ color: "var(--danger)" }}>
            Falhou
          </p>
          <p className="line-clamp-2 text-[10px] leading-relaxed text-[var(--ink-3)]">
            {variant.errorDetail ?? "Erro desconhecido"}
          </p>
        </div>
      ) : (
        <ProcessingState
          index={index}
          taskId={variant.taskId}
          status={variant.status}
          createdAt={variant.createdAt}
        />
      )}

      {/* Top-left tag: V01 · ENGINE */}
      <div
        className={cn(
          "pointer-events-none absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-md border px-2 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.08em] backdrop-blur",
          isFavorite
            ? "border-[var(--accent)]/50 bg-[var(--accent)]/10 text-[var(--accent)]"
            : "border-[var(--line-2)] bg-black/60 text-[var(--ink-2)]"
        )}
      >
        <span>V{String(index + 1).padStart(2, "0")}</span>
        <span className="text-[var(--ink-4)]">·</span>
        <span>{variant.engineUsed === "glabs" ? "G-LABS" : "GEMINI"}</span>
      </div>

      {/* Hover actions */}
      {isDone && (
        <div className="pointer-events-none absolute inset-x-3 top-3 flex items-center justify-end gap-1 opacity-0 transition-opacity duration-200 group-hover:pointer-events-auto group-hover:opacity-100">
          {onToggleFavorite && (
            <ActionButton
              title="Favoritar"
              onClick={(e) => {
                stop(e);
                onToggleFavorite(variant);
              }}
              active={isFavorite}
              icon={
                <Star
                  className="size-3.5"
                  fill={isFavorite ? "currentColor" : "none"}
                />
              }
            />
          )}
          {onUseAsRef && (
            <ActionButton
              title="Usar como style ref"
              onClick={(e) => {
                stop(e);
                onUseAsRef(variant);
              }}
              icon={<BookmarkPlus className="size-3.5" />}
            />
          )}
          {onRefine && (
            <ActionButton
              title="Refinar com instruções"
              onClick={(e) => {
                stop(e);
                onRefine(variant);
              }}
              icon={<Wand2 className="size-3.5" />}
            />
          )}
          {onDownload && (
            <ActionButton
              title="Download PNG"
              onClick={(e) => {
                stop(e);
                onDownload(variant);
              }}
              icon={<Download className="size-3.5" />}
            />
          )}
          {onZoom && (
            <ActionButton
              title="Expandir"
              onClick={(e) => {
                stop(e);
                onZoom(variant);
              }}
              icon={<Maximize2 className="size-3.5" />}
            />
          )}
          {onRemove && (
            <ActionButton
              title="Remover"
              danger
              onClick={(e) => {
                stop(e);
                onRemove(variant);
              }}
              icon={<Trash2 className="size-3.5" />}
            />
          )}
        </div>
      )}

      {/* Bottom strip: seed */}
      {isDone && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t from-black/80 via-black/40 to-transparent px-3 pb-2 pt-8">
          <span className="font-mono text-[10px] tracking-[0.06em] text-[var(--ink-3)]">
            seed · {seed}
          </span>
          <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--ink-3)]">
            {variant.engineUsed === "glabs" ? "1920×1080" : "1920×1080"}
          </span>
        </div>
      )}
    </motion.div>
  );
}

function ActionButton({
  title,
  onClick,
  icon,
  danger,
  active,
}: {
  title: string;
  onClick: (e: React.MouseEvent) => void;
  icon: React.ReactNode;
  danger?: boolean;
  active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      aria-label={title}
      className={cn(
        "grid size-8 place-items-center rounded-md border border-[var(--line-2)] bg-black/70 text-[var(--ink-2)] backdrop-blur transition-all hover:bg-black/90 hover:text-[var(--ink)]",
        danger && "hover:border-[var(--danger)]/50 hover:bg-[var(--danger)]/15 hover:text-[var(--danger)]",
        active && "border-[var(--accent)]/50 bg-[var(--accent)]/10 text-[var(--accent)]"
      )}
    >
      {icon}
    </button>
  );
}

function ProcessingState({
  index,
  taskId,
  status,
  createdAt,
}: {
  index: number;
  taskId: string | null;
  status: string;
  createdAt: number;
}) {
  const isQueued = status === "pending";
  const [pct, setPct] = React.useState(0);

  // Synthetic progress: asymptotic curve aproximando 99% (nunca atinge 100%
  // sem evento real de "completed" do backend). Sobe rápido no início e
  // desacelera, mas continua creeping mesmo em gerações longas — assim o
  // usuário não vê o número parar e achar que travou.
  React.useEffect(() => {
    if (isQueued) {
      setPct(0);
      return;
    }
    const TYPICAL_MS = 18_000;
    const tick = () => {
      const elapsed = Date.now() - createdAt;
      const raw = (1 - Math.exp(-elapsed / TYPICAL_MS)) * 99;
      setPct(Math.min(99, raw));
    };
    tick();
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [createdAt, isQueued]);

  return (
    <div className="flex size-full flex-col items-center justify-center gap-3 bg-[var(--bg-2)] px-4">
      <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--ink-3)]">
        V{String(index + 1).padStart(2, "0")} · {isQueued ? "queued" : "rendering"}
      </div>
      {isQueued ? (
        <Loader2 className="size-5 animate-spin" style={{ color: "var(--accent)" }} />
      ) : (
        <>
          <div className="display tabular text-[28px] font-semibold leading-none tracking-[-0.02em] text-[var(--ink)]">
            {Math.round(pct)}%
          </div>
          <div className="relative h-1 w-32 overflow-hidden rounded-full bg-[var(--line-2)]">
            <div
              className="absolute inset-y-0 left-0 transition-[width] duration-200"
              style={{
                width: `${pct}%`,
                background: "var(--grad-cta)",
              }}
            />
          </div>
        </>
      )}
      {taskId && (
        <div className="font-mono text-[9px] text-[var(--ink-4)]">
          task · {taskId.slice(0, 8)}
        </div>
      )}
    </div>
  );
}
