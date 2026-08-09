"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Star,
  Download as DownloadIcon,
  RefreshCw,
  ImageIcon,
  Grid2x2,
  Grid3x3,
  LayoutGrid,
  ChevronRight,
} from "lucide-react";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";

import { usePersonas } from "@/lib/hooks/use-personas";
import { useHealth } from "@/components/shared/engine-status-dot";
import { buildDownloadName, fileUrl } from "@/lib/format";
import { cn } from "@/lib/utils";

import { Hero } from "@/components/workbench/hero";
import {
  Composer,
  applySuggestionsToComposer,
  type ComposerState,
} from "@/components/workbench/composer";
import { CompetitorPreviewPanel } from "@/components/workbench/competitor-preview-panel";
import { Marquee } from "@/components/workbench/marquee";
import { RefineDialog } from "@/components/workbench/refine-dialog";
import { ThumbCard } from "@/components/workbench/thumb-card";
import { Lightbox } from "@/components/workbench/lightbox";

import type {
  AnalysisResult,
  EngineId,
  Generation,
  GenerationVariant,
  ObjectSwap,
  Persona,
  TextSwap,
} from "@/lib/types";

interface StatusResponse {
  generation: Generation;
  variants: GenerationVariant[];
  persona: Persona | null;
}

interface HistoryItem {
  generation: Generation;
  persona: { id: string; name: string; channel: string | null } | null;
  thumbnail: string | null;
  variantCount: number;
  completedCount: number;
}

const STAGES = [
  "analisando referência",
  "compondo cena",
  "renderizando",
  "aplicando texto",
  "finalizando",
];

function WorkbenchPageInner() {
  const router = useRouter();
  const qc = useQueryClient();
  const { data: personasData } = usePersonas();
  const { data: health } = useHealth();

  // ─── Composer state ──────────────────────────────────────────────
  const [state, setStateRaw] = React.useState<ComposerState>({
    personaId: null,
    competitorPath: null,
    competitorUrl: null,
    competitorTitle: null,
    title: "",
    prompt: "",
    extra: "",
    variants: 4,
    engine: "glabs",
    ratio: "16:9",
  });
  const set = React.useCallback(
    (patch: Partial<ComposerState>) =>
      setStateRaw((s) => ({ ...s, ...patch })),
    []
  );

  // Auto-pick first persona ONCE on initial load.
  // Why: o composer permite "Sem persona" (personaId = null). Sem o ref,
  // o effect refazia o pick toda vez que o usuário escolhia "Sem persona".
  const autoPickedPersonaRef = React.useRef(false);
  React.useEffect(() => {
    if (autoPickedPersonaRef.current || !personasData) return;
    autoPickedPersonaRef.current = true;
    if (!state.personaId && personasData.personas.length) {
      set({ personaId: personasData.personas[0].id });
    }
  }, [personasData, state.personaId, set]);

  // ─── Analysis state (auto on competitor change) ─────────────────
  const [analysis, setAnalysis] = React.useState<AnalysisResult | null>(null);
  const [textSwaps, setTextSwaps] = React.useState<TextSwap[]>([]);
  const [objectSwaps, setObjectSwaps] = React.useState<ObjectSwap[]>([]);

  const lastAnalyzedRef = React.useRef<string | null>(null);
  const analyze = useMutation({
    mutationFn: async (imagePath: string) => {
      const r = await fetch("/api/analyze-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imagePath }),
      });
      const json = await r.json();
      if (!r.ok) throw new Error(json.error ?? "Falha");
      return json.analysis as AnalysisResult;
    },
    onSuccess: (a) => {
      setAnalysis(a);
      setTextSwaps(
        a.detectedText.map((t) => ({
          original: t.text,
          action: "replace",
          replacement: "",
          position: t.position,
          style: t.style,
        }))
      );
      setObjectSwaps(
        a.objects.map((o) => ({
          original: o.name,
          action: "replace",
          replacement: "",
          position: o.position,
        }))
      );
      toast.success("Thumb analisada — modo Recriar viral ativo");
    },
    onError: (e) => {
      toast.error((e as Error).message);
    },
  });

  React.useEffect(() => {
    if (
      state.competitorPath &&
      state.competitorPath !== lastAnalyzedRef.current &&
      health?.claude === "configured"
    ) {
      lastAnalyzedRef.current = state.competitorPath;
      analyze.mutate(state.competitorPath);
    }
    if (!state.competitorPath) {
      lastAnalyzedRef.current = null;
      setAnalysis(null);
      setTextSwaps([]);
      setObjectSwaps([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.competitorPath, health?.claude]);

  // ─── Mode (controlado pelo tab do composer) ─────────────────────
  const [mode, setMode] = React.useState<"remodel" | "from-scratch">(
    "from-scratch"
  );

  // ─── Generation state ───────────────────────────────────────────
  const [generationId, setGenerationIdRaw] = React.useState<string | null>(
    null
  );
  const [progress, setProgress] = React.useState(0);
  const [stage, setStage] = React.useState(STAGES[0]);
  const setGenerationId = React.useCallback((id: string | null) => {
    setGenerationIdRaw(id);
    if (typeof window === "undefined") return;
    if (id) localStorage.setItem("tf:lastGenerationId", id);
    else localStorage.removeItem("tf:lastGenerationId");
  }, []);
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = localStorage.getItem("tf:lastGenerationId");
    if (saved) setGenerationIdRaw(saved);
  }, []);

  // Status polling
  const status = useQuery<StatusResponse>({
    queryKey: ["status", generationId],
    queryFn: async () => {
      const r = await fetch(`/api/status/${generationId}`, {
        cache: "no-store",
      });
      if (r.status === 404) {
        setGenerationId(null);
        throw new Error("Geração não existe mais");
      }
      if (!r.ok) throw new Error("Status falhou");
      return r.json();
    },
    enabled: !!generationId,
    retry: false,
    refetchInterval: (q) => {
      const data = q.state.data;
      if (!data) return 3000;
      const allDone = data.variants.every(
        (v) => v.status === "completed" || v.status === "failed"
      );
      return allDone ? false : 3000;
    },
  });

  const variants = status.data?.variants ?? [];
  const allDone =
    variants.length > 0 &&
    variants.every((v) => v.status === "completed" || v.status === "failed");

  // Progress global = MÉDIA dos progressos sintéticos por variante.
  // Usa exatamente a mesma curva do ProcessingState (thumb-card.tsx) pra
  // que o número do botão "Gerando… X%" e os números nos cards fiquem
  // sempre sincronizados.
  React.useEffect(() => {
    if (!generationId || allDone) {
      setProgress(0);
      return;
    }
    const TYPICAL_MS = 18_000;
    const computeGlobal = () => {
      if (variants.length === 0) return 0;
      let total = 0;
      for (const v of variants) {
        if (v.status === "completed" || v.status === "failed") {
          total += 100;
        } else if (v.status === "pending") {
          total += 0;
        } else {
          const elapsed = Date.now() - v.createdAt;
          total += Math.min(99, (1 - Math.exp(-elapsed / TYPICAL_MS)) * 99);
        }
      }
      return total / variants.length;
    };
    const tick = () => setProgress(computeGlobal());
    tick();
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [generationId, variants, allDone]);

  React.useEffect(() => {
    if (!generationId || allDone) return;
    const idx = Math.min(STAGES.length - 1, Math.floor(progress / 22));
    setStage(STAGES[idx]);
  }, [progress, generationId, allDone]);

  React.useEffect(() => {
    if (allDone && generationId) {
      setProgress(100);
      qc.invalidateQueries({ queryKey: ["history"] });
    }
  }, [allDone, generationId, qc]);

  // Toast quando uma variante falha — com tratamento especial pra violação
  // de política de conteúdo (G-Labs/Gemini bloqueiam imagens/prompts sensíveis).
  const toastedFailedRef = React.useRef(new Set<string>());
  React.useEffect(() => {
    for (const v of variants) {
      if (v.status !== "failed") continue;
      if (toastedFailedRef.current.has(v.id)) continue;
      toastedFailedRef.current.add(v.id);
      const detail = v.errorDetail ?? "";
      const isViolation =
        /violat|polic|safety|blocked|rejected|recitation|prohibited|unsafe|content[_\s-]?(policy|filter|moderation)|nsfw|inappropriate|harmful|sensitive/i.test(
          detail
        );
      const idx = v.variantIndex + 1;
      if (isViolation) {
        toast.error(
          `Variante ${idx}: bloqueada por política de conteúdo. O modelo recusou a imagem/prompt enviado. Tente trocar o competitor ou ajustar o prompt.`,
          { duration: 10_000 }
        );
      } else {
        toast.error(
          `Variante ${idx} falhou: ${detail.slice(0, 140) || "erro desconhecido"}`,
          { duration: 8_000 }
        );
      }
    }
  }, [variants]);
  // Reset do tracker quando troca de geração
  React.useEffect(() => {
    toastedFailedRef.current = new Set();
  }, [generationId]);

  // ─── Generate ────────────────────────────────────────────────────
  const generate = useMutation({
    mutationFn: async () => {
      const payload =
        mode === "remodel"
          ? {
              personaId: state.personaId,
              competitorPath: state.competitorPath,
              competitorUrl: state.competitorUrl,
              mode: "remodel" as const,
              textSwaps,
              objectSwaps,
              compositionAnchor: analysis?.composition,
              extraInstructions: state.extra || undefined,
              variantCount: state.variants,
              engine: state.engine,
            }
          : {
              personaId: state.personaId,
              competitorPath: state.competitorPath,
              competitorUrl: state.competitorUrl,
              mode: "from-scratch" as const,
              // `title` é só identificação interna (rename de download, listagem
              // no histórico). NÃO entra no prompt nem vira texto na imagem.
              title: state.title || undefined,
              concept: state.prompt,
              extraInstructions: state.extra || undefined,
              variantCount: state.variants,
              engine: state.engine,
            };
      const r = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        throw new Error(body.error ?? "Falha ao gerar");
      }
      return r.json() as Promise<{ generationId: string; warnings?: string[] }>;
    },
    onSuccess: (data) => {
      setGenerationId(data.generationId);
      setProgress(2);
      toast.success(
        `${state.variants} variante${state.variants > 1 ? "s" : ""} na fila`
      );
      // Ex.: styles descartados por causa do teto de referências da engine.
      data.warnings?.forEach((w) => toast.warning(w, { duration: 8000 }));
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const handleGenerate = () => {
    // Persona é opcional. Sem persona, o backend gera só a partir do prompt
    // (sem face/style refs). Validação de persona acontece só no useAsRef.
    if (mode === "from-scratch" && state.prompt.trim().length < 5) {
      toast.error("Descreva sua thumbnail no prompt");
      return;
    }
    if (mode === "remodel" && textSwaps.length === 0 && objectSwaps.length === 0) {
      toast.error("Adicione pelo menos um swap pro modo remodelar");
      return;
    }
    if (state.engine === "glabs" && health?.glabs === "down") {
      toast.error(
        "G-Labs offline — abre o Chrome com a extensão (ou configura o túnel Tailscale em /settings)"
      );
      return;
    }
    generate.mutate();
  };

  // ─── Competitor handlers (for composer) ──────────────────────────
  const onUploadCompetitor = async (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    const r = await fetch("/api/competitors/upload", {
      method: "POST",
      body: fd,
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error ?? "Upload falhou");
    set({ competitorPath: data.thumbRelPath, competitorUrl: null, competitorTitle: null });
    toast.success("Imagem anexada");
  };
  const onFetchUrl = async (url: string) => {
    const r = await fetch(`/api/youtube?url=${encodeURIComponent(url)}`);
    const data = await r.json();
    if (!r.ok) throw new Error(data.error ?? "Falha");
    set({
      competitorPath: data.thumbRelPath,
      competitorUrl: url,
      competitorTitle: data.suggestedTitle ?? null,
    });
    if (data.suggestedTitle && !state.title) {
      set({ title: String(data.suggestedTitle) });
    }
    toast.success("Thumb concorrente carregada");
  };
  const onClearCompetitor = () => {
    set({ competitorPath: null, competitorUrl: null, competitorTitle: null });
  };

  // ─── Lightbox ────────────────────────────────────────────────────
  const [lightboxIndex, setLightboxIndex] = React.useState<number | null>(null);

  const downloadVariant = (v: GenerationVariant) => {
    if (!v.outputPath) return;
    const a = document.createElement("a");
    a.href = fileUrl(v.outputPath);
    const personaName =
      status.data?.persona?.name ?? persona?.name ?? null;
    const title = status.data?.generation.title ?? state.title ?? null;
    const total =
      status.data?.generation.variantCount ??
      variants.length ??
      state.variants;
    const ext = (v.outputPath.split(".").pop() || "png").toLowerCase();
    const fancy = buildDownloadName(personaName, title, v.variantIndex ?? 0, total, ext);
    a.download = fancy ?? v.outputPath.split("/").pop() ?? `thumbnail.${ext}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const useAsRef = useMutation({
    mutationFn: async (v: GenerationVariant) => {
      if (!state.personaId) throw new Error("Sem persona");
      if (!v.outputPath) throw new Error("Sem imagem");
      const r = await fetch(`/api/personas/${state.personaId}/refs/clone`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fromPath: v.outputPath }),
      });
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        throw new Error(body.error ?? "Falha");
      }
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["personas"] });
      toast.success("Adicionada como style ref");
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const [deleteVariantId, setDeleteVariantId] = React.useState<string | null>(
    null
  );

  const deleteVariant = useMutation({
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
      if (data.generationDeleted) setGenerationId(null);
      qc.invalidateQueries({ queryKey: ["status", generationId] });
      qc.invalidateQueries({ queryKey: ["history"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const [refineVariant, setRefineVariant] = React.useState<GenerationVariant | null>(
    null
  );

  const refineMut = useMutation({
    mutationFn: async ({
      v,
      instructions,
    }: {
      v: GenerationVariant;
      instructions: string;
    }) => {
      const original = status.data?.generation;
      if (!original) throw new Error("Sem geração original");
      if (!v.outputPath) throw new Error("Variante sem imagem");
      // Usa o output da variante como anchor (igual modo remodel) e injeta
      // as instruções do usuário como extras. O prompt final pede pra o
      // engine preservar o resto e aplicar só o que foi descrito.
      const payload = {
        personaId: original.personaId,
        competitorPath: v.outputPath,
        mode: "remodel" as const,
        textSwaps: [],
        objectSwaps: [],
        extraInstructions: instructions,
        variantCount: 1,
        engine: original.engineRequested,
        title: original.title ?? undefined,
      };
      const r = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        throw new Error(body.error ?? "Falha ao refinar");
      }
      return r.json() as Promise<{ generationId: string; warnings?: string[] }>;
    },
    onSuccess: (data) => {
      setGenerationId(data.generationId);
      setRefineVariant(null);
      toast.success("Refinando — gerando nova versão");
      data.warnings?.forEach((w) => toast.warning(w, { duration: 8000 }));
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const regenerateVariant = useMutation({
    mutationFn: async (_v: GenerationVariant) => {
      const original = status.data?.generation;
      if (!original) throw new Error("Sem geração original");
      const payload =
        original.mode === "remodel" && original.swaps
          ? {
              personaId: original.personaId,
              competitorPath: original.competitorPath,
              competitorUrl: original.competitorUrl,
              mode: "remodel",
              textSwaps: original.swaps.textSwaps,
              objectSwaps: original.swaps.objectSwaps,
              variantCount: 1,
              engine: original.engineRequested,
            }
          : {
              personaId: original.personaId,
              competitorPath: original.competitorPath,
              competitorUrl: original.competitorUrl,
              mode: "from-scratch",
              headlineMainWhite: original.headlineMainWhite,
              concept: original.concept,
              variantCount: 1,
              engine: original.engineRequested,
            };
      const r = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        throw new Error(body.error ?? "Falha");
      }
      return r.json() as Promise<{ generationId: string; warnings?: string[] }>;
    },
    onSuccess: (data) => {
      setGenerationId(data.generationId);
      toast.success("Refazendo");
      data.warnings?.forEach((w) => toast.warning(w, { duration: 8000 }));
    },
    onError: (e) => toast.error((e as Error).message),
  });

  // ─── Favorites & cols (local state, persists to localStorage) ────
  const [favorites, setFavorites] = React.useState<Set<string>>(new Set());
  const [cols, setCols] = React.useState<2 | 3 | 4>(2);
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const c = Number(localStorage.getItem("tf:cols"));
    if (c === 2 || c === 3 || c === 4) setCols(c);
    const favs = localStorage.getItem("tf:favs");
    if (favs) setFavorites(new Set(JSON.parse(favs)));
  }, []);
  const setColsPersist = (c: 2 | 3 | 4) => {
    setCols(c);
    localStorage.setItem("tf:cols", String(c));
  };
  const toggleFavorite = (v: GenerationVariant) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(v.id)) next.delete(v.id);
      else next.add(v.id);
      localStorage.setItem("tf:favs", JSON.stringify([...next]));
      return next;
    });
  };

  // ─── Recent history strip ───────────────────────────────────────
  const recent = useQuery<{ items: HistoryItem[] }>({
    queryKey: ["history", "recent"],
    queryFn: async () => {
      const r = await fetch("/api/history?limit=12", { cache: "no-store" });
      if (!r.ok) throw new Error("Falha");
      return r.json();
    },
  });

  // ─── Prefill via ?regen= ────────────────────────────────────────
  const [regenId, setRegenId] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    setRegenId(params.get("regen"));
  }, []);
  const [prefillDone, setPrefillDone] = React.useState(false);
  React.useEffect(() => {
    if (!regenId || prefillDone) return;
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(`/api/status/${regenId}`, { cache: "no-store" });
        if (!r.ok) throw new Error("Geração não encontrada");
        const data = (await r.json()) as StatusResponse;
        if (cancelled) return;
        const g = data.generation;
        set({
          personaId: g.personaId,
          title: g.title || g.headlineMainWhite || g.headlineTop || "",
          prompt: g.concept,
          extra: "",
          variants: (g.variantCount as 1 | 2 | 3 | 4) ?? 4,
          engine: g.engineRequested,
          competitorPath: g.competitorPath,
          competitorUrl: g.competitorUrl,
          competitorTitle: null,
        });
        if (g.swaps) {
          setTextSwaps(g.swaps.textSwaps);
          setObjectSwaps(g.swaps.objectSwaps);
        }
        // Restaura o modo da geração original
        setMode(g.mode === "remodel" ? "remodel" : "from-scratch");
        toast.success("Inputs pré-preenchidos");
        setPrefillDone(true);
        router.replace("/", { scroll: false });
      } catch (e) {
        toast.error((e as Error).message);
        setPrefillDone(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [regenId, prefillDone, router, set]);

  // ─── ⌘↵ shortcut ────────────────────────────────────────────────
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key === "Enter") {
        e.preventDefault();
        handleGenerate();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handleGenerate]);

  const persona =
    personasData?.personas.find((p) => p.id === state.personaId) ?? null;

  // ─── Competitor preview panel ────────────────────────────────────────
  // Regra: aparece quando há competitor anexado em modo remodel, persiste
  // até a geração completar, e o usuário pode fechar a qualquer momento (X).
  const [previewDismissed, setPreviewDismissed] = React.useState(false);
  React.useEffect(() => {
    // Reset toda vez que o competitor muda ou um novo batch é disparado.
    setPreviewDismissed(false);
  }, [state.competitorPath, generationId]);
  React.useEffect(() => {
    // Auto-fecha quando todas as variantes terminam.
    if (allDone && generationId && variants.length > 0) {
      setPreviewDismissed(true);
    }
  }, [allDone, generationId, variants.length]);
  const previewVisible =
    mode === "remodel" && !!state.competitorPath && !previewDismissed;

  // ─── Render ─────────────────────────────────────────────────────
  return (
    <>
      <Hero persona={persona} />

      <div className="relative">
        {previewVisible && state.competitorPath && (
          <CompetitorPreviewPanel
            path={state.competitorPath}
            url={state.competitorUrl}
            title={state.competitorTitle}
            isAnalyzing={analyze.isPending}
            onDismiss={() => setPreviewDismissed(true)}
          />
        )}

        <Composer
          state={state}
          set={set}
          personas={personasData?.personas ?? []}
          mode={mode}
          onModeChange={setMode}
          onGenerate={handleGenerate}
          generating={generate.isPending || (!!generationId && !allDone)}
          progress={progress}
          stage={stage}
          analysis={analysis}
          isAnalyzing={analyze.isPending}
          onUploadCompetitor={onUploadCompetitor}
          onFetchUrl={onFetchUrl}
          onClearCompetitor={onClearCompetitor}
          textSwaps={textSwaps}
          objectSwaps={objectSwaps}
          setTextSwaps={setTextSwaps}
          setObjectSwaps={setObjectSwaps}
          onApplySuggestions={(a) => applySuggestionsToComposer(a, set)}
        />
      </div>

      <div className="mt-14">
        <Marquee />
      </div>

      {/* Gallery */}
      <section className="relative z-[1] mx-auto mt-16 max-w-[1280px] px-8">
        <div className="mb-7 flex items-end justify-between gap-4">
          <div>
            <h2 className="display text-[clamp(36px,4vw,56px)] font-bold leading-[1] tracking-[-0.02em] text-[var(--ink)]">
              Suas <span className="italic text-gradient">thumbnails</span>
            </h2>
            <div className="mt-2 flex items-center gap-3 font-mono text-[11.5px] uppercase tracking-[0.04em] text-[var(--ink-3)]">
              <span>
                <b className="font-semibold text-[var(--ink)]">{variants.length}</b>{" "}
                variantes
              </span>
              <span className="text-[var(--ink-5)]">·</span>
              <span>
                <b className="font-semibold text-[var(--ink)]">{favorites.size}</b>{" "}
                favoritadas
              </span>
              <span className="text-[var(--ink-5)]">·</span>
              <span>
                persona{" "}
                <b
                  className="font-semibold"
                  style={{ color: "var(--accent)" }}
                >
                  {persona?.name?.split(" ")[0] ?? "—"}
                </b>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <div className="inline-flex rounded-[9px] border border-[var(--line-2)] bg-[var(--bg-2)] p-[3px]">
              {[
                { c: 2, icon: <Grid2x2 className="size-3.5" /> },
                { c: 3, icon: <Grid3x3 className="size-3.5" /> },
                { c: 4, icon: <LayoutGrid className="size-3.5" /> },
              ].map((g) => (
                <button
                  key={g.c}
                  onClick={() => setColsPersist(g.c as 2 | 3 | 4)}
                  className={cn(
                    "grid h-7 w-8 place-items-center rounded-md transition-all",
                    cols === g.c
                      ? "bg-[var(--bg-4)] text-[var(--ink)] shadow-[inset_0_0_0_1px_var(--line-3)]"
                      : "text-[var(--ink-3)] hover:text-[var(--ink-2)]"
                  )}
                  aria-label={`${g.c} colunas`}
                >
                  {g.icon}
                </button>
              ))}
            </div>
            <button
              onClick={handleGenerate}
              disabled={!variants.length || generate.isPending}
              className="inline-flex items-center gap-2 rounded-[9px] border border-[var(--line-2)] bg-[var(--bg-2)] px-3 py-2 text-[12.5px] font-medium text-[var(--ink-2)] hover:border-[var(--line-3)] hover:bg-[var(--bg-3)] hover:text-[var(--ink)] disabled:opacity-50"
            >
              <RefreshCw className="size-3.5" /> Regerar
            </button>
            <button
              onClick={() => {
                variants.filter((v) => v.outputPath).forEach(downloadVariant);
              }}
              disabled={!variants.length}
              className="inline-flex items-center gap-2 rounded-[9px] border-transparent px-3 py-2 text-[12.5px] font-bold text-[#050507] disabled:opacity-50"
              style={{
                background: "var(--grad-cta)",
                boxShadow: "0 4px 12px rgba(198,242,78,.25)",
              }}
            >
              <DownloadIcon className="size-3.5" /> Exportar tudo
            </button>
          </div>
        </div>

        {variants.length === 0 ? (
          <EmptyGallery />
        ) : (
          <div
            className="grid gap-4"
            style={{
              gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
            }}
          >
            {variants.map((v, i) => (
              <ThumbCard
                key={v.id}
                variant={v}
                index={i}
                isFavorite={favorites.has(v.id)}
                onZoom={() => setLightboxIndex(i)}
                onDownload={downloadVariant}
                onUseAsRef={(vt) => useAsRef.mutate(vt)}
                onRefine={(vt) => setRefineVariant(vt)}
                onToggleFavorite={toggleFavorite}
                onRemove={(vt) => setDeleteVariantId(vt.id)}
              />
            ))}
          </div>
        )}
      </section>

      {/* Recent batches strip */}
      <section className="relative z-[1] mx-auto mb-20 mt-14 max-w-[1280px] px-8">
        <div className="mb-5 flex items-end justify-between border-b border-[var(--line)] pb-4">
          <div>
            <h3 className="display text-[26px] font-semibold tracking-[-0.01em] text-[var(--ink)]">
              Histórico <span className="italic text-gradient">recente</span>
            </h3>
            <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--ink-3)]">
              últimos {recent.data?.items.length ?? 0} batches
            </p>
          </div>
          <Link
            href="/history"
            className="group inline-flex items-center gap-1.5 rounded-full border border-[var(--line-2)] bg-[var(--bg-2)] px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.12em] text-[var(--ink-2)] transition-all hover:border-[var(--accent)]/40 hover:text-[var(--accent)]"
          >
            Ver tudo
            <ChevronRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {recent.isLoading
            ? Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="aspect-video shimmer rounded-xl opacity-30"
                />
              ))
            : (recent.data?.items ?? []).slice(0, 6).map((it, i) => (
                <Link
                  key={it.generation.id}
                  href={`/?regen=${it.generation.id}`}
                  className="group relative aspect-video overflow-hidden rounded-xl border border-[var(--line-2)] bg-[var(--bg-2)] transition-all duration-300 hover:-translate-y-1 hover:border-[var(--accent)]/40 hover:shadow-[0_18px_48px_-16px_rgba(198,242,78,0.18)]"
                >
                  {it.thumbnail ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={fileUrl(it.thumbnail)}
                      alt=""
                      className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                    />
                  ) : (
                    <div className="grid size-full place-items-center text-[var(--ink-4)]">
                      <ImageIcon className="size-6" />
                    </div>
                  )}
                  <span className="absolute left-2 top-2 rounded font-mono text-[9px] tracking-[0.12em] text-white/90 mix-blend-difference">
                    {String(i + 1).padStart(3, "0")}
                  </span>
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t from-black/95 via-black/50 to-transparent px-3 pb-2 pt-6">
                    <span className="flex items-center gap-1.5 truncate font-mono text-[10px] uppercase tracking-[0.1em] text-white">
                      <b className="truncate">{it.persona?.name?.split(" ")[0] ?? "—"}</b>
                      <span className="text-[var(--ink-4)]">·</span>
                      <span className="text-[var(--ink-3)]">
                        {it.completedCount}/{it.variantCount}
                      </span>
                    </span>
                    <span
                      className="text-[9px] font-mono uppercase tracking-[0.1em]"
                      style={{ color: "var(--accent)" }}
                    >
                      {it.generation.mode === "remodel" ? "rmd" : "scr"}
                    </span>
                  </div>
                </Link>
              ))}
        </div>
      </section>

      <RefineDialog
        variant={refineVariant}
        open={!!refineVariant}
        onOpenChange={(o) => !o && !refineMut.isPending && setRefineVariant(null)}
        loading={refineMut.isPending}
        onSubmit={(instructions) => {
          if (refineVariant) {
            refineMut.mutate({ v: refineVariant, instructions });
          }
        }}
      />

      <ConfirmDialog
        open={!!deleteVariantId}
        onOpenChange={(o) => !o && !deleteVariant.isPending && setDeleteVariantId(null)}
        title="Excluir essa imagem?"
        description={
          <>
            Essa variante e seu arquivo serão removidos permanentemente. Essa
            ação não pode ser desfeita.
          </>
        }
        confirmLabel="Excluir"
        destructive
        loading={deleteVariant.isPending}
        onConfirm={() => deleteVariantId && deleteVariant.mutate(deleteVariantId)}
      />

      {lightboxIndex !== null && (
        <Lightbox
          variants={variants}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onPrev={() =>
            setLightboxIndex(
              (i) => (i! - 1 + variants.length) % variants.length
            )
          }
          onNext={() =>
            setLightboxIndex((i) => (i! + 1) % variants.length)
          }
          onDownload={downloadVariant}
          onRegenerate={(v) => regenerateVariant.mutate(v)}
          onCopyPrompt={() => {
            if (status.data?.generation.promptFinal) {
              navigator.clipboard.writeText(status.data.generation.promptFinal);
              toast.success("Prompt copiado");
            }
          }}
        />
      )}
    </>
  );
}

function EmptyGallery() {
  return (
    <div
      className="relative grid place-items-center overflow-hidden rounded-2xl border border-dashed border-[var(--line-2)] bg-white/[0.02] py-20 text-center"
      style={{ minHeight: 360 }}
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 60% 50% at 50% 30%, rgba(198,242,78,.08), transparent 70%)",
        }}
      />
      {/* Faux thumbnails preview */}
      <div className="pointer-events-none absolute inset-x-8 top-1/2 -translate-y-1/2 grid grid-cols-2 gap-3 opacity-[0.04]">
        {[0, 1].map((i) => (
          <div
            key={i}
            className="aspect-video rounded-xl border border-[var(--line-3)] bg-[var(--bg-2)]"
          />
        ))}
      </div>
      <div className="relative space-y-4 px-6">
        <div
          className="mx-auto grid size-16 place-items-center rounded-2xl border border-[var(--line-2)] bg-[var(--bg-2)]"
          style={{ boxShadow: "0 0 0 6px rgba(255,255,255,0.02), 0 0 32px rgba(198,242,78,.12)" }}
        >
          <Star
            className="size-7"
            style={{ color: "var(--accent)" }}
            fill="currentColor"
          />
        </div>
        <div className="space-y-1.5">
          <p className="display text-2xl font-semibold tracking-[-0.02em] text-[var(--ink-2)]">
            Nada gerado <span className="italic text-gradient">ainda</span>
          </p>
          <p className="mx-auto max-w-sm text-[12px] leading-relaxed text-[var(--ink-3)]">
            Configure os inputs no composer acima e clique <b className="text-[var(--ink-2)]">Gerar</b>.
            Suas variantes aparecem aqui em ~3 segundos.
          </p>
        </div>
        <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-[var(--line-2)] bg-[var(--bg-2)] px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--ink-3)]">
          <kbd className="rounded border border-[var(--line-2)] bg-[var(--bg-3)] px-1.5 py-0.5 text-[var(--ink-2)]">
            ⌘ ↵
          </kbd>
          <span>atalho rápido</span>
        </div>
      </div>
    </div>
  );
}

export default function WorkbenchPage() {
  return <WorkbenchPageInner />;
}
