"use client";

import * as React from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  History as HistoryIcon,
  ImageIcon,
  ArrowUpRight,
  Trash2,
} from "lucide-react";

import { buildDownloadName, fileUrl, formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { ThumbCard } from "@/components/workbench/thumb-card";
import { Lightbox } from "@/components/workbench/lightbox";
import type { Generation, GenerationVariant } from "@/lib/types";

interface HistoryItem {
  generation: Generation;
  persona: { id: string; name: string; channel: string | null } | null;
  thumbnail: string | null;
  variantCount: number;
  completedCount: number;
}

interface DetailResponse {
  generation: Generation;
  variants: GenerationVariant[];
  persona: { id: string; name: string } | null;
}

export default function HistoryPage() {
  const { data, isLoading } = useQuery<{ items: HistoryItem[] }>({
    queryKey: ["history"],
    queryFn: async () => {
      const r = await fetch("/api/history?limit=60", { cache: "no-store" });
      if (!r.ok) throw new Error("Falha");
      return r.json();
    },
    // Refresca a cada 3s enquanto houver algum batch com variantes pendentes
    refetchInterval: (q) => {
      const items = q.state.data?.items ?? [];
      const anyRunning = items.some(
        (it) => it.completedCount < it.variantCount
      );
      return anyRunning ? 3000 : false;
    },
  });

  const [openId, setOpenId] = React.useState<string | null>(null);
  const [lightboxIndex, setLightboxIndex] = React.useState<number | null>(null);
  const [deleteId, setDeleteId] = React.useState<string | null>(null);
  const qc = useQueryClient();

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/status/${id}`, { method: "DELETE" });
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        throw new Error(body.error ?? "Falha ao excluir");
      }
      return r.json();
    },
    onSuccess: (_data, id) => {
      toast.success("Batch excluído");
      setDeleteId(null);
      if (openId === id) setOpenId(null);
      qc.invalidateQueries({ queryKey: ["history"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const itemBeingDeleted = React.useMemo(
    () => data?.items.find((it) => it.generation.id === deleteId) ?? null,
    [data, deleteId]
  );

  const [deleteVariantId, setDeleteVariantId] = React.useState<string | null>(
    null
  );

  const deleteVariantMut = useMutation({
    mutationFn: async (variantId: string) => {
      const r = await fetch(`/api/variants/${variantId}`, { method: "DELETE" });
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        throw new Error(body.error ?? "Falha ao excluir");
      }
      return r.json() as Promise<{ ok: true; generationDeleted: boolean }>;
    },
    onSuccess: (data) => {
      toast.success("Imagem excluída");
      setDeleteVariantId(null);
      qc.invalidateQueries({ queryKey: ["status", openId] });
      qc.invalidateQueries({ queryKey: ["history"] });
      if (data.generationDeleted) setOpenId(null);
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const detail = useQuery<DetailResponse>({
    queryKey: ["status", openId],
    queryFn: async () => {
      const r = await fetch(`/api/status/${openId}`, { cache: "no-store" });
      if (!r.ok) throw new Error("Falha");
      return r.json();
    },
    enabled: !!openId,
    // Polling enquanto houver variantes em pending/running — assim a %
    // dentro do dialog de detalhe atualiza ao vivo.
    refetchInterval: (q) => {
      const data = q.state.data;
      if (!data) return 3000;
      const allDone = data.variants.every(
        (v) => v.status === "completed" || v.status === "failed"
      );
      return allDone ? false : 3000;
    },
  });

  const downloadVariant = (v: GenerationVariant) => {
    if (!v.outputPath) return;
    const a = document.createElement("a");
    a.href = fileUrl(v.outputPath);
    const personaName = detail.data?.persona?.name ?? null;
    const title = detail.data?.generation.title ?? null;
    const total = detail.data?.generation.variantCount ?? detail.data?.variants.length ?? 1;
    const ext = (v.outputPath.split(".").pop() || "png").toLowerCase();
    const fancy = buildDownloadName(personaName, title, v.variantIndex ?? 0, total, ext);
    a.download = fancy ?? v.outputPath.split("/").pop() ?? `thumbnail.${ext}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  return (
    <div className="mx-auto max-w-[1280px] px-8 py-14">
      <header className="mb-10 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-[var(--ink-3)]">
            Archive · Histórico
          </p>
          <h1 className="display text-[clamp(34px,5vw,56px)] font-bold leading-[1] tracking-[-0.02em] text-[var(--ink)]">
            Toda <span className="text-gradient italic">geração</span>
          </h1>
          <p className="max-w-[520px] text-[14px] leading-[1.5] text-[var(--ink-3)]">
            Clique em qualquer batch pra ver as variantes em alta resolução, o prompt usado e refazer.
          </p>
        </div>
        {data?.items.length ? (
          <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-[var(--ink-3)]">
            {String(data.items.length).padStart(2, "0")} batches
          </p>
        ) : null}
      </header>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="aspect-video shimmer rounded-xl opacity-30"
            />
          ))}
        </div>
      ) : !data?.items.length ? (
        <div
          className="relative grid place-items-center overflow-hidden rounded-2xl border border-dashed border-[var(--line-2)] bg-white/[0.02] py-24 text-center"
          style={{ minHeight: 320 }}
        >
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse 60% 50% at 50% 30%, rgba(198,242,78,.06), transparent 70%)",
            }}
          />
          <div className="relative space-y-3">
            <div className="mx-auto grid size-14 place-items-center rounded-full border border-[var(--line-2)] bg-[var(--bg-2)] text-[var(--ink-3)]">
              <HistoryIcon
                className="size-6"
                style={{ color: "var(--accent)" }}
              />
            </div>
            <p className="display text-2xl font-semibold italic text-[var(--ink-2)]">
              Sem gerações ainda
            </p>
            <Button asChild className="mt-3">
              <Link href="/">Ir pro Workbench</Link>
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {data.items.map((item, i) => (
            <div
              key={item.generation.id}
              onClick={() => setOpenId(item.generation.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setOpenId(item.generation.id);
                }
              }}
              role="button"
              tabIndex={0}
              className="group relative flex cursor-pointer flex-col overflow-hidden rounded-xl border border-[var(--line-2)] bg-[var(--bg-2)] text-left transition-all duration-300 hover:-translate-y-0.5 hover:border-[var(--accent)]/30 hover:shadow-[0_18px_48px_-16px_rgba(198,242,78,0.18)]"
            >
              <div className="relative aspect-video overflow-hidden bg-[var(--bg-3)]">
                {item.thumbnail ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={fileUrl(item.thumbnail)}
                    alt=""
                    className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                  />
                ) : (
                  <div className="grid size-full place-items-center text-[var(--ink-4)]">
                    <ImageIcon className="size-10" />
                  </div>
                )}

                <span className="absolute left-3 top-3 font-mono text-[10px] tracking-[0.18em] text-white/90 mix-blend-difference">
                  {String(i + 1).padStart(3, "0")}
                </span>

                {item.completedCount < item.variantCount ? (
                  <>
                    <div
                      className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[9.5px] font-bold uppercase tracking-[0.12em] text-[#050507] shadow-[0_4px_12px_rgba(198,242,78,.3)]"
                      style={{ background: "var(--grad-cta)" }}
                    >
                      <span className="pulse-dot inline-block size-1.5 rounded-full bg-[#050507]" />
                      Gerando · {Math.round((item.completedCount / item.variantCount) * 100)}%
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/50">
                      <div
                        className="h-full transition-[width] duration-300"
                        style={{
                          width: `${(item.completedCount / item.variantCount) * 100}%`,
                          background: "var(--grad-cta)",
                        }}
                      />
                    </div>
                  </>
                ) : (
                  <div className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full border border-[var(--line-2)] bg-black/70 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em] text-[var(--ink-2)] backdrop-blur">
                    {item.completedCount}/{item.variantCount}
                  </div>
                )}

                <span className="absolute bottom-3 right-3 grid size-9 place-items-center rounded-full bg-black/70 text-white opacity-0 ring-1 ring-[var(--line-2)] backdrop-blur transition-opacity group-hover:opacity-100">
                  <ArrowUpRight className="size-4" />
                </span>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteId(item.generation.id);
                  }}
                  title="Excluir batch"
                  aria-label="Excluir batch"
                  className="absolute bottom-3 left-3 grid size-9 place-items-center rounded-full border border-[var(--line-2)] bg-black/70 text-[var(--ink-2)] opacity-0 backdrop-blur transition-all hover:border-[var(--danger)]/60 hover:bg-[var(--danger)]/20 hover:text-[var(--danger)] group-hover:opacity-100"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>

              <div className="space-y-1.5 border-t border-[var(--line)] p-4">
                <p className="line-clamp-2 display text-[15px] font-semibold leading-tight text-[var(--ink)]">
                  {item.generation.title ||
                    item.generation.headlineMainWhite ||
                    item.generation.headlineMainYellow ||
                    item.generation.concept}
                </p>
                <p className="flex items-center gap-1 truncate font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--ink-3)]">
                  <span className="truncate">{item.persona?.name ?? "—"}</span>
                  <span>·</span>
                  <span>{formatDate(item.generation.createdAt)}</span>
                  <span>·</span>
                  <span style={{ color: "var(--accent)" }}>
                    {item.generation.mode === "remodel" ? "remodel" : "scratch"}
                  </span>
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!openId} onOpenChange={(o) => !o && setOpenId(null)}>
        <DialogContent className="!max-w-[min(1400px,95vw)] sm:!max-w-[min(1400px,95vw)] max-h-[90vh] overflow-y-auto scrollbar-thin">
          <DialogHeader>
            <DialogTitle className="display text-2xl font-semibold tracking-[-0.02em]">
              {detail.data?.generation.title ||
                detail.data?.generation.headlineMainWhite ||
                detail.data?.generation.headlineMainYellow || (
                  <span className="italic text-[var(--ink-3)]">Geração</span>
                )}
            </DialogTitle>
          </DialogHeader>

          {!detail.data ? (
            <div className="aspect-video shimmer rounded-lg opacity-30" />
          ) : (
            <div className="space-y-5">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {detail.data.variants.map((v, i) => (
                  <ThumbCard
                    key={v.id}
                    variant={v}
                    index={i}
                    onZoom={() => setLightboxIndex(i)}
                    onDownload={downloadVariant}
                    onRemove={(vt) => setDeleteVariantId(vt.id)}
                  />
                ))}
              </div>

              <details className="rounded-lg border border-[var(--line-2)] px-3 py-2">
                <summary className="cursor-pointer font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--ink-3)] hover:text-[var(--ink)]">
                  Prompt usado
                </summary>
                <pre className="mt-2 max-h-64 overflow-y-auto whitespace-pre-wrap rounded-md bg-[var(--bg-3)] p-3 font-mono text-[11px] leading-relaxed text-[var(--ink-2)] scrollbar-thin">
                  {detail.data.generation.promptFinal}
                </pre>
              </details>

              <div className="flex flex-wrap items-center justify-between gap-4 font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--ink-3)]">
                <div className="flex items-center gap-3">
                  <span>
                    Persona{" "}
                    <b className="font-semibold text-[var(--ink)]">
                      {detail.data.persona?.name ?? "—"}
                    </b>
                  </span>
                  <span className="text-[var(--ink-5)]">·</span>
                  <span>
                    Engine{" "}
                    <b className="font-semibold text-[var(--ink)]">
                      {detail.data.generation.engineRequested === "glabs"
                        ? "G-Labs"
                        : "Gemini"}
                    </b>
                  </span>
                  <span className="text-[var(--ink-5)]">·</span>
                  <span>{formatDate(detail.data.generation.createdAt)}</span>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--line)] pt-4">
                <Button
                  variant="ghost"
                  onClick={() => openId && setDeleteId(openId)}
                  className="text-[var(--ink-3)] hover:bg-[var(--danger)]/10 hover:text-[var(--danger)]"
                >
                  <Trash2 className="size-4" /> Excluir batch
                </Button>
                <div className="flex gap-2">
                  <Button variant="ghost" onClick={() => setOpenId(null)}>
                    Close
                  </Button>
                  <Button asChild>
                    <Link href={{ pathname: "/", query: { regen: openId } }}>
                      Refazer no Workbench
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteVariantId}
        onOpenChange={(o) =>
          !o && !deleteVariantMut.isPending && setDeleteVariantId(null)
        }
        title="Excluir essa imagem?"
        description="Essa variante e seu arquivo serão removidos permanentemente. Essa ação não pode ser desfeita."
        confirmLabel="Excluir"
        destructive
        loading={deleteVariantMut.isPending}
        onConfirm={() =>
          deleteVariantId && deleteVariantMut.mutate(deleteVariantId)
        }
      />

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(o) => !o && !deleteMut.isPending && setDeleteId(null)}
        title="Excluir batch?"
        description={
          itemBeingDeleted ? (
            <>
              <b>
                {itemBeingDeleted.generation.title ||
                  itemBeingDeleted.generation.headlineMainWhite ||
                  itemBeingDeleted.generation.headlineMainYellow ||
                  itemBeingDeleted.generation.concept.slice(0, 60)}
              </b>{" "}
              · {itemBeingDeleted.variantCount}{" "}
              {itemBeingDeleted.variantCount === 1 ? "variante" : "variantes"}{" "}
              serão removidas permanentemente. Essa ação não pode ser desfeita.
            </>
          ) : (
            "Esse batch será removido permanentemente. Essa ação não pode ser desfeita."
          )
        }
        confirmLabel="Excluir"
        destructive
        loading={deleteMut.isPending}
        onConfirm={() => deleteId && deleteMut.mutate(deleteId)}
      />

      {detail.data && (
        <Lightbox
          variants={detail.data.variants}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onPrev={() =>
            setLightboxIndex(
              (i) =>
                (i! - 1 + detail.data!.variants.length) %
                detail.data!.variants.length
            )
          }
          onNext={() =>
            setLightboxIndex(
              (i) => (i! + 1) % detail.data!.variants.length
            )
          }
          onDownload={downloadVariant}
        />
      )}
    </div>
  );
}
