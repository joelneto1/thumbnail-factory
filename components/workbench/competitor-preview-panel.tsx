"use client";

import * as React from "react";
import { Loader2, X, ExternalLink, ZoomIn } from "lucide-react";

import { Dialog, DialogContent } from "@/components/ui/dialog";
import { fileUrl } from "@/lib/format";

export function CompetitorPreviewPanel({
  path,
  url,
  title,
  isAnalyzing,
  onDismiss,
}: {
  path: string;
  url: string | null;
  title: string | null;
  isAnalyzing: boolean;
  onDismiss: () => void;
}) {
  const [enlarged, setEnlarged] = React.useState(false);
  return (
    <>
    <aside
      // Posicionamento absoluto relativo ao wrapper (que envolve o Composer):
      //   top-4 = mesmo mt-4 do composer-section → alinha com topo do card
      //   left calc = composer-left - gap - panel-width = 50% - 460 - 16 - 320
      // Fallback pra 24px nas viewports onde o calc daria off-screen.
      className="pointer-events-none absolute top-1 z-20 hidden w-[420px] xl:block"
      style={{ left: "max(24px, calc(50% - 896px))" }}
      aria-label="Preview da thumb concorrente"
    >
      <div className="pointer-events-auto rounded-2xl border border-[var(--line-2)] bg-[var(--bg-2)]/95 p-3 shadow-[0_18px_48px_-12px_rgba(0,0,0,0.55)] backdrop-blur-xl">
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--ink-3)]">
            Concorrente · ref
          </span>
          <button
            type="button"
            onClick={onDismiss}
            title="Fechar preview"
            aria-label="Fechar preview"
            className="grid size-6 place-items-center rounded-md border border-[var(--line-2)] bg-[var(--bg-3)] text-[var(--ink-3)] transition-all hover:border-[var(--danger)]/50 hover:bg-[var(--danger)]/15 hover:text-[var(--danger)]"
          >
            <X className="size-3" />
          </button>
        </div>

        <button
          type="button"
          onClick={() => setEnlarged(true)}
          title="Ampliar"
          aria-label="Ampliar preview"
          className="group relative block aspect-video w-full cursor-zoom-in overflow-hidden rounded-lg border border-[var(--line-3)] bg-[var(--bg-3)]"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={fileUrl(path)}
            alt="Thumb concorrente"
            className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
          />
          <span className="pointer-events-none absolute right-2 top-2 grid size-7 place-items-center rounded-md bg-black/70 text-white opacity-0 ring-1 ring-white/15 backdrop-blur-sm transition-opacity duration-200 group-hover:opacity-100">
            <ZoomIn className="size-3.5" />
          </span>
          {isAnalyzing && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/65 backdrop-blur-sm">
              <Loader2
                className="size-5 animate-spin"
                style={{ color: "var(--accent)" }}
              />
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--ink-2)]">
                analisando
              </span>
            </div>
          )}
        </button>

        {title && (
          <p className="mt-2.5 line-clamp-2 text-[12.5px] leading-[1.35] text-[var(--ink-2)]">
            {title}
          </p>
        )}

        {url && (
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="mt-1.5 flex items-center gap-1.5 truncate font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--ink-4)] transition-colors hover:text-[var(--accent)]"
          >
            <ExternalLink className="size-3 shrink-0" />
            <span className="truncate">
              {url.replace(/^https?:\/\//, "").replace(/\/$/, "")}
            </span>
          </a>
        )}
      </div>
    </aside>

    <Dialog open={enlarged} onOpenChange={setEnlarged}>
      <DialogContent
        showCloseButton={false}
        className="!max-w-[min(1400px,95vw)] sm:!max-w-[min(1400px,95vw)] border-none bg-transparent p-0 shadow-none"
      >
        <div className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={fileUrl(path)}
            alt="Thumb concorrente em tamanho real"
            className="block max-h-[88vh] w-full rounded-xl object-contain"
          />
          <button
            type="button"
            onClick={() => setEnlarged(false)}
            aria-label="Fechar"
            className="absolute right-3 top-3 grid size-9 place-items-center rounded-full border border-white/20 bg-black/70 text-white backdrop-blur transition-all hover:bg-black/90"
          >
            <X className="size-4" />
          </button>
          {(title || url) && (
            <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 rounded-b-xl bg-gradient-to-t from-black/85 via-black/40 to-transparent p-5 pt-12">
              <div className="min-w-0">
                {title && (
                  <p className="line-clamp-2 display text-[15px] font-semibold text-white">
                    {title}
                  </p>
                )}
                {url && (
                  <a
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 flex items-center gap-1.5 truncate font-mono text-[10px] uppercase tracking-[0.1em] text-white/70 hover:text-white"
                  >
                    <ExternalLink className="size-3 shrink-0" />
                    <span className="truncate">
                      {url.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                    </span>
                  </a>
                )}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}
