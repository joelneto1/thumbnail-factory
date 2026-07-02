"use client";

import { Loader2, ScanText, Sparkles, RefreshCw, AlertCircle } from "lucide-react";
import { motion } from "framer-motion";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { AnalysisResult } from "@/lib/types";

export function AnalysisCard({
  analysis,
  isAnalyzing,
  isError,
  errorMessage,
  onRetry,
  onApplySuggestions,
}: {
  analysis: AnalysisResult | null;
  isAnalyzing: boolean;
  isError: boolean;
  errorMessage?: string;
  onRetry?: () => void;
  onApplySuggestions?: (a: AnalysisResult) => void;
}) {
  if (isAnalyzing) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3">
        <Loader2 className="size-4 animate-spin text-primary" />
        <div className="flex-1">
          <p className="font-display text-sm italic text-foreground">
            Reading the thumbnail
          </p>
          <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
            text · colors · objects · composition
          </p>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3">
        <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
        <div className="flex-1 space-y-1">
          <p className="text-xs font-semibold text-destructive">Analysis failed</p>
          <p className="text-xs leading-relaxed text-destructive/80">
            {errorMessage ?? "Erro desconhecido"}
          </p>
        </div>
        {onRetry && (
          <Button variant="ghost" size="sm" onClick={onRetry}>
            <RefreshCw className="size-3.5" /> Retry
          </Button>
        )}
      </div>
    );
  }

  if (!analysis) return null;

  const hasAnyText = analysis.detectedText.length > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className="space-y-4 rounded-lg border border-border/60 bg-card/40 p-4"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ScanText className="size-3.5 text-primary" />
          <p className="font-display text-sm italic">Reading complete</p>
        </div>
        {onRetry && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={onRetry}
                className="grid size-6 place-items-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <RefreshCw className="size-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent>Re-analyze</TooltipContent>
          </Tooltip>
        )}
      </div>

      {hasAnyText && (
        <div className="space-y-2">
          <p className="label-eyebrow">Detected text</p>
          <ul className="space-y-1.5">
            {analysis.detectedText.slice(0, 6).map((t, i) => (
              <li key={i} className="flex items-baseline gap-2 text-xs">
                <span className="rounded bg-secondary/60 px-1.5 py-0.5 font-medium text-foreground">
                  &ldquo;{t.text}&rdquo;
                </span>
                <span className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                  {t.position}
                  {t.color && ` · ${t.color}`}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {analysis.dominantColors.length > 0 && (
        <div className="space-y-2">
          <p className="label-eyebrow">Palette</p>
          <div className="flex flex-wrap items-center gap-1.5">
            {analysis.dominantColors.map((c, i) => (
              <Tooltip key={i}>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-1.5 rounded-md border border-border/60 bg-card px-1.5 py-1">
                    <span
                      className="size-3.5 rounded-sm ring-1 ring-border"
                      style={{ backgroundColor: c.hex }}
                    />
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {c.hex}
                    </span>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  {c.name}
                  {c.role && ` · ${c.role}`}
                </TooltipContent>
              </Tooltip>
            ))}
          </div>
        </div>
      )}

      {analysis.objects.length > 0 && (
        <div className="space-y-2">
          <p className="label-eyebrow">Objects</p>
          <div className="flex flex-wrap gap-1.5">
            {analysis.objects.map((o, i) => (
              <Badge key={i} variant="outline" className="text-[10px]">
                {o.name}
                {o.position && (
                  <span className="text-muted-foreground"> · {o.position}</span>
                )}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {analysis.composition && (
        <p className="font-display text-sm italic leading-relaxed text-muted-foreground">
          &ldquo;{analysis.composition}&rdquo;
        </p>
      )}

      {onApplySuggestions &&
        (analysis.suggestedHeadlineTop ||
          analysis.suggestedHeadlineMainWhite ||
          analysis.suggestedConcept) && (
          <Button
            size="sm"
            variant="secondary"
            className="w-full"
            onClick={() => onApplySuggestions(analysis)}
          >
            <Sparkles className="size-3.5" />
            Apply detected text as suggestion
          </Button>
        )}
    </motion.div>
  );
}
