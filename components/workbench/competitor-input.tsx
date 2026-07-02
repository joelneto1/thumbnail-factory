"use client";

import * as React from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Link as LinkIcon, Upload, X, Loader2, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ImageDrop } from "@/components/personas/image-drop";
import { fileUrl } from "@/lib/format";

interface CompetitorState {
  thumbRelPath: string | null;
  url: string | null;
  suggestedTitle: string | null;
}

export function CompetitorInput({
  value,
  onChange,
  onSuggestedTitle,
}: {
  value: CompetitorState;
  onChange: (next: CompetitorState) => void;
  onSuggestedTitle?: (title: string) => void;
}) {
  const [url, setUrl] = React.useState(value.url ?? "");

  const fetchUrl = useMutation({
    mutationFn: async (input: string) => {
      const r = await fetch(`/api/youtube?url=${encodeURIComponent(input)}`);
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        throw new Error(body.error ?? "Falha ao buscar thumbnail");
      }
      return r.json() as Promise<{
        thumbRelPath: string;
        suggestedTitle: string | null;
        videoId: string;
      }>;
    },
    onSuccess: (data) => {
      onChange({
        thumbRelPath: data.thumbRelPath,
        url,
        suggestedTitle: data.suggestedTitle,
      });
      if (data.suggestedTitle && onSuggestedTitle) {
        onSuggestedTitle(data.suggestedTitle);
      }
      toast.success("Thumbnail carregada");
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const uploadFile = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData();
      fd.append("file", file);
      const r = await fetch("/api/competitors/upload", {
        method: "POST",
        body: fd,
      });
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        throw new Error(body.error ?? "Falha no upload");
      }
      return r.json() as Promise<{ thumbRelPath: string }>;
    },
    onSuccess: (data) => {
      onChange({ thumbRelPath: data.thumbRelPath, url: null, suggestedTitle: null });
      toast.success("Imagem carregada");
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const clear = () => {
    onChange({ thumbRelPath: null, url: null, suggestedTitle: null });
    setUrl("");
  };

  if (value.thumbRelPath) {
    return (
      <div className="space-y-2">
        <div className="relative overflow-hidden rounded-lg border border-border/60 bg-secondary/40">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={fileUrl(value.thumbRelPath)}
            alt="Competitor"
            className="aspect-video w-full object-cover"
          />
          <button
            onClick={clear}
            className="absolute right-2 top-2 grid size-8 place-items-center rounded-md bg-background/90 text-foreground ring-1 ring-border transition hover:bg-destructive hover:text-destructive-foreground"
          >
            <X className="size-4" />
          </button>
          {value.url && (
            <span className="pointer-events-none absolute bottom-2 left-2 truncate rounded-md bg-background/85 px-2 py-1 font-mono text-[9px] tracking-[0.1em] text-muted-foreground backdrop-blur">
              {value.url.replace(/^https?:\/\//, "")}
            </span>
          )}
        </div>
        {value.suggestedTitle && (
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            <span className="label-eyebrow mr-1">Title</span>
            <span className="text-foreground/90">{value.suggestedTitle}</span>
          </p>
        )}
      </div>
    );
  }

  return (
    <Tabs defaultValue="url" className="space-y-3">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="url">
          <LinkIcon className="size-3.5" /> URL
        </TabsTrigger>
        <TabsTrigger value="upload">
          <Upload className="size-3.5" /> Upload
        </TabsTrigger>
      </TabsList>

      <TabsContent value="url" className="space-y-2">
        <div className="flex gap-2">
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://youtu.be/..."
            className="font-mono text-xs"
            onKeyDown={(e) => {
              if (e.key === "Enter" && url.trim() && !fetchUrl.isPending) {
                fetchUrl.mutate(url.trim());
              }
            }}
          />
          <Button
            onClick={() => url.trim() && fetchUrl.mutate(url.trim())}
            disabled={!url.trim() || fetchUrl.isPending}
            variant="secondary"
          >
            {fetchUrl.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Search className="size-4" />
            )}
            Fetch
          </Button>
        </div>
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Cola a URL — puxamos a thumbnail e o título do vídeo.
        </p>
      </TabsContent>

      <TabsContent value="upload">
        <ImageDrop
          onFile={(f) => uploadFile.mutate(f)}
          isUploading={uploadFile.isPending}
          helpText="Drop image or click to upload"
          className="aspect-video"
        />
      </TabsContent>
    </Tabs>
  );
}
