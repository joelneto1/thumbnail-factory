"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Loader2 } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

export function CreatePersonaDialog({
  trigger,
}: {
  trigger?: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [channel, setChannel] = React.useState("");
  const [notes, setNotes] = React.useState("");

  const qc = useQueryClient();
  const router = useRouter();

  const create = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/personas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          channel: channel.trim() || undefined,
          notes: notes.trim() || undefined,
        }),
      });
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        throw new Error(body.error ?? "Erro ao criar");
      }
      return r.json() as Promise<{ persona: { id: string } }>;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["personas"] });
      toast.success("Persona criada");
      setOpen(false);
      setName("");
      setChannel("");
      setNotes("");
      router.push(`/personas/${data.persona.id}`);
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button className="font-display">
            <Plus className="size-4" /> New persona
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-display text-2xl tracking-tight">
            <span className="italic">New</span> persona
          </DialogTitle>
          <DialogDescription>
            Crie um preset de canal. Você adiciona a face e as referências de
            estilo na próxima tela.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label htmlFor="persona-name" className="label-eyebrow">
              Name *
            </Label>
            <Input
              id="persona-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ex: David Sinclair"
              autoFocus
              className="font-display text-base"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="persona-channel" className="label-eyebrow">
              Channel
            </Label>
            <Input
              id="persona-channel"
              value={channel}
              onChange={(e) => setChannel(e.target.value)}
              placeholder="ex: Lifespan"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="persona-notes" className="label-eyebrow">
              Notes
            </Label>
            <Textarea
              id="persona-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Tom de voz, paleta de cores preferida, restrições..."
              rows={3}
              className="resize-none"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            disabled={!name.trim() || create.isPending}
            onClick={() => create.mutate()}
            className="font-display"
          >
            {create.isPending && <Loader2 className="size-4 animate-spin" />}
            Create persona
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
