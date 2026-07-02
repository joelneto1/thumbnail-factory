"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Trash2, ImagePlus, Loader2, X } from "lucide-react";

import { usePersona } from "@/lib/hooks/use-personas";
import { fileUrl, formatRelative } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ImageDrop } from "@/components/personas/image-drop";

export default function PersonaEditorPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();
  const qc = useQueryClient();
  const { data, isLoading } = usePersona(id);

  const [name, setName] = React.useState("");
  const [channel, setChannel] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [confirmDelete, setConfirmDelete] = React.useState(false);

  React.useEffect(() => {
    if (data?.persona) {
      setName(data.persona.name);
      setChannel(data.persona.channel ?? "");
      setNotes(data.persona.notes ?? "");
    }
  }, [data?.persona]);

  const saveMeta = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/personas/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          channel: channel.trim() || null,
          notes: notes.trim() || null,
        }),
      });
      if (!r.ok) throw new Error("Falha ao salvar");
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["persona", id] });
      qc.invalidateQueries({ queryKey: ["personas"] });
      toast.success("Persona atualizada");
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const uploadFace = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData();
      fd.append("file", file);
      const r = await fetch(`/api/personas/${id}/refs?kind=face`, {
        method: "POST",
        body: fd,
      });
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        throw new Error(body.error ?? "Falha");
      }
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["persona", id] });
      qc.invalidateQueries({ queryKey: ["personas"] });
      toast.success("Face atualizada");
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const uploadStyle = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData();
      fd.append("file", file);
      const r = await fetch(`/api/personas/${id}/refs?kind=style`, {
        method: "POST",
        body: fd,
      });
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        throw new Error(body.error ?? "Falha");
      }
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["persona", id] });
      toast.success("Style ref adicionada");
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const removeStyle = useMutation({
    mutationFn: async (path: string) => {
      const r = await fetch(
        `/api/personas/${id}/refs?path=${encodeURIComponent(path)}`,
        { method: "DELETE" }
      );
      if (!r.ok) throw new Error("Falha");
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["persona", id] });
      toast.success("Removida");
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const deletePersona = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/personas/${id}`, { method: "DELETE" });
      if (!r.ok) throw new Error("Falha");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["personas"] });
      toast.success("Persona removida");
      router.push("/personas");
    },
    onError: (e) => toast.error((e as Error).message),
  });

  if (isLoading) {
    return (
      <div className="mx-auto max-w-5xl px-8 py-14">
        <div className="aspect-[2/1] shimmer rounded-2xl opacity-30" />
      </div>
    );
  }

  if (!data?.persona) {
    return (
      <div className="mx-auto max-w-5xl px-8 py-20 text-center">
        <p className="display text-2xl italic text-[var(--ink-3)]">
          Persona não encontrada.
        </p>
      </div>
    );
  }

  const persona = data.persona;

  return (
    <div className="mx-auto max-w-5xl px-8 py-14">
      <div className="mb-8 flex items-center justify-between">
        <Link
          href="/personas"
          className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.12em] text-[var(--ink-3)] hover:text-[var(--ink)]"
        >
          <ArrowLeft className="size-3.5" /> Back to cast
        </Link>
        <button
          onClick={() => setConfirmDelete(true)}
          className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.12em] text-[var(--ink-3)] hover:text-[var(--danger)]"
        >
          <Trash2 className="size-3.5" /> Delete
        </button>
      </div>

      <header className="mb-10 space-y-2">
        <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-[var(--ink-3)]">
          Persona · {formatRelative(persona.createdAt)}
        </p>
        <h1 className="display text-[clamp(34px,5vw,56px)] font-bold leading-[1] tracking-[-0.02em] text-[var(--ink)]">
          <span className="italic">{persona.name}</span>
        </h1>
        {persona.channel && (
          <p className="text-[14px] text-[var(--ink-3)]">{persona.channel}</p>
        )}
      </header>

      <div className="grid gap-12 lg:grid-cols-[320px_1fr]">
        {/* Face slot */}
        <section className="space-y-4">
          <div className="space-y-1">
            <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--ink-3)]">
              01 / Face reference
            </p>
            <p className="text-[12px] leading-relaxed text-[var(--ink-3)]">
              A foto que substitui a pessoa em toda thumbnail gerada.
            </p>
          </div>

          {persona.facePath ? (
            <div className="space-y-3">
              <div className="overflow-hidden rounded-xl border border-[var(--line-2)] bg-[var(--bg-3)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={fileUrl(persona.facePath)}
                  alt="Face"
                  className="aspect-square w-full object-cover"
                />
              </div>
              <ImageDrop
                onFile={(f) => uploadFace.mutate(f)}
                isUploading={uploadFace.isPending}
                helpText="Trocar face"
                className="py-3"
              />
            </div>
          ) : (
            <ImageDrop
              onFile={(f) => uploadFace.mutate(f)}
              isUploading={uploadFace.isPending}
              helpText="Arraste a face ou clique"
              className="aspect-square"
            >
              <ImagePlus
                className="size-8"
                style={{ color: "var(--accent)" }}
              />
              <span className="display text-[14px] font-semibold italic text-[var(--ink)]">
                Adicionar face
              </span>
              <span className="font-mono text-[10px] uppercase tracking-[0.12em]">
                PNG · JPG · WebP
              </span>
            </ImageDrop>
          )}
        </section>

        {/* Meta + style refs */}
        <div className="space-y-12">
          <section className="space-y-5">
            <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--ink-3)]">
              02 / Identity
            </p>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label
                  htmlFor="name"
                  className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--ink-3)]"
                >
                  Name
                </Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="display text-lg font-semibold"
                />
              </div>
              <div className="space-y-2">
                <Label
                  htmlFor="channel"
                  className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--ink-3)]"
                >
                  Channel
                </Label>
                <Input
                  id="channel"
                  value={channel}
                  onChange={(e) => setChannel(e.target.value)}
                  placeholder="Optional"
                />
              </div>
              <div className="space-y-2">
                <Label
                  htmlFor="notes"
                  className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--ink-3)]"
                >
                  Notes
                </Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  placeholder="Tom de voz, paleta preferida, restrições..."
                  className="resize-none"
                />
              </div>
              <Button
                onClick={() => saveMeta.mutate()}
                disabled={saveMeta.isPending}
              >
                {saveMeta.isPending && (
                  <Loader2 className="size-4 animate-spin" />
                )}
                Salvar
              </Button>
            </div>
          </section>

          <section className="space-y-4">
            <div className="flex items-baseline justify-between">
              <div className="space-y-1">
                <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--ink-3)]">
                  03 / Style references
                </p>
                <p className="text-[12px] leading-relaxed text-[var(--ink-3)]">
                  Imagens auxiliares pra reforçar a estética. Opcional.
                </p>
              </div>
              <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--ink-3)]">
                {String(persona.stylePaths.length).padStart(2, "0")} added
              </span>
            </div>

            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
              {persona.stylePaths.map((p) => (
                <div
                  key={p}
                  className="group relative aspect-square overflow-hidden rounded-lg border border-[var(--line-2)] bg-[var(--bg-3)]"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={fileUrl(p)}
                    alt="Style"
                    className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
                  />
                  <button
                    onClick={() => removeStyle.mutate(p)}
                    className="absolute right-1.5 top-1.5 grid size-6 place-items-center rounded-full bg-black/85 text-white opacity-0 ring-1 ring-[var(--line-3)] transition-all hover:bg-[var(--danger)] group-hover:opacity-100"
                  >
                    <X className="size-3" />
                  </button>
                </div>
              ))}
              <ImageDrop
                onFile={(f) => uploadStyle.mutate(f)}
                isUploading={uploadStyle.isPending}
                helpText="Add"
                className="aspect-square"
              />
            </div>
          </section>
        </div>
      </div>

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Deletar persona?</DialogTitle>
            <DialogDescription>
              Vai apagar <strong>{persona.name}</strong>, suas referências e o
              histórico de gerações associado. Não dá pra desfazer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => deletePersona.mutate()}
              disabled={deletePersona.isPending}
            >
              {deletePersona.isPending && (
                <Loader2 className="size-4 animate-spin" />
              )}
              Deletar permanentemente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
