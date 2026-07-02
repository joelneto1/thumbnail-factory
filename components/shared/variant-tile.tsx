"use client";

import {
  Loader2,
  AlertTriangle,
  Download,
  RefreshCw,
  ImageIcon,
  BookmarkPlus,
} from "lucide-react";
import { motion } from "framer-motion";

import { cn } from "@/lib/utils";
import { fileUrl } from "@/lib/format";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { GenerationVariant } from "@/lib/types";

export function VariantTile({
  variant,
  onZoom,
  onDownload,
  onRegenerate,
  onUseAsRef,
}: {
  variant: GenerationVariant;
  onZoom?: (v: GenerationVariant) => void;
  onDownload?: (v: GenerationVariant) => void;
  onRegenerate?: (v: GenerationVariant) => void;
  onUseAsRef?: (v: GenerationVariant) => void;
}) {
  const isFailed = variant.status === "failed";
  const isDone = variant.status === "completed";

  const stop = (e: React.MouseEvent) => e.stopPropagation();

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        "group relative aspect-video overflow-hidden rounded-xl border border-border/60 bg-secondary/40 transition-all duration-300",
        isFailed && "border-destructive/50",
        isDone && onZoom && "cursor-zoom-in hover:border-primary/40 hover:shadow-[0_18px_48px_-16px_oklch(0.84_0.155_78_/_0.18)]"
      )}
      onClick={() => isDone && onZoom?.(variant)}
      role={isDone && onZoom ? "button" : undefined}
      tabIndex={isDone && onZoom ? 0 : undefined}
      onKeyDown={(e) => {
        if (isDone && onZoom && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onZoom(variant);
        }
      }}
    >
      {isDone && variant.outputPath ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={fileUrl(variant.outputPath)}
          alt={`Variant ${variant.variantIndex + 1}`}
          className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
        />
      ) : isFailed ? (
        <div className="flex size-full flex-col items-center justify-center gap-2 p-4 text-center">
          <AlertTriangle className="size-6 text-destructive" />
          <p className="font-display text-sm italic text-destructive">Failed</p>
          <p className="line-clamp-2 text-[10px] leading-relaxed text-destructive/70">
            {variant.errorDetail ?? "Erro desconhecido"}
          </p>
        </div>
      ) : (
        <div className="flex size-full flex-col items-center justify-center gap-3 text-muted-foreground">
          <Loader2 className="size-6 animate-spin text-primary" />
          <p className="text-[11px] uppercase tracking-[0.18em]">
            {variant.status === "pending" ? "Queued" : "Producing"}
          </p>
          {variant.taskId && (
            <p className="font-mono text-[9px] tracking-[0.1em] opacity-50">
              task · {variant.taskId.slice(0, 8)}
            </p>
          )}
        </div>
      )}

      {/* Top-left: variant index */}
      <div className="pointer-events-none absolute left-3 top-3 flex items-center gap-2">
        <span className="rounded-full bg-background/85 px-2 py-0.5 font-mono text-[9px] tracking-[0.15em] text-foreground backdrop-blur">
          {String(variant.variantIndex + 1).padStart(2, "0")}
        </span>
      </div>

      {/* Top-right: engine badge */}
      <div className="pointer-events-none absolute right-3 top-3">
        <span
          className={cn(
            "rounded-full border px-2 py-0.5 text-[9px] font-mono uppercase tracking-[0.15em] backdrop-blur",
            variant.engineUsed === "glabs"
              ? "border-border/60 bg-background/85 text-muted-foreground"
              : "border-primary/40 bg-primary/10 text-primary"
          )}
        >
          {variant.engineUsed === "glabs" ? "G-Labs" : "Gemini"}
        </span>
      </div>

      {isDone && (
        <div className="pointer-events-none absolute inset-x-3 bottom-3 flex items-center justify-end gap-1.5 opacity-0 transition-opacity duration-200 group-hover:pointer-events-auto group-hover:opacity-100">
          {onUseAsRef && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  className="grid size-9 place-items-center rounded-md bg-background/90 text-foreground backdrop-blur transition hover:bg-background"
                  onClick={(e) => {
                    stop(e);
                    onUseAsRef(variant);
                  }}
                >
                  <BookmarkPlus className="size-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent>Use as style ref</TooltipContent>
            </Tooltip>
          )}
          {onRegenerate && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  className="grid size-9 place-items-center rounded-md bg-background/90 text-foreground backdrop-blur transition hover:bg-background"
                  onClick={(e) => {
                    stop(e);
                    onRegenerate(variant);
                  }}
                >
                  <RefreshCw className="size-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent>Regenerate</TooltipContent>
            </Tooltip>
          )}
          {onDownload && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  className="grid size-9 place-items-center rounded-md bg-primary text-primary-foreground transition hover:bg-primary/90"
                  onClick={(e) => {
                    stop(e);
                    onDownload(variant);
                  }}
                >
                  <Download className="size-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent>Download PNG</TooltipContent>
            </Tooltip>
          )}
        </div>
      )}

      {!isDone && !isFailed && variant.status === "pending" && (
        <div className="absolute inset-0 grid place-items-center text-muted-foreground/20">
          <ImageIcon className="size-12" />
        </div>
      )}
    </motion.div>
  );
}
