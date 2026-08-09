"use client";

import * as React from "react";
import Link from "next/link";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Sparkles,
  RefreshCw,
  User,
  Upload,
  Loader2,
  Zap,
  AlertCircle,
  X,
  Plus,
  Search,
  ScanText,
  Type,
  Box,
  Trash2,
  Pencil,
  CheckCircle2,
  UserX,
  Wand2,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { fileUrl } from "@/lib/format";
import { useHealth } from "@/components/shared/engine-status-dot";
import { Chip, type ChipOption } from "./chip-picker";
import type {
  EngineId,
  Persona,
  AnalysisResult,
  TextSwap,
  ObjectSwap,
  SwapAction,
} from "@/lib/types";

export type ComposerMode = "from-scratch" | "remodel";

export interface ComposerState {
  personaId: string | null;
  competitorPath: string | null;
  competitorUrl: string | null;
  competitorTitle: string | null;
  title: string;
  prompt: string;
  extra: string;
  variants: 1 | 2 | 3 | 4;
  engine: EngineId;
  ratio: "16:9" | "9:16";
}

const HINT_OPTIONS = [
  "rosto da persona em close",
  "vermelho saturado, drama documental",
  "texto enorme à esquerda",
  "fundo azul gradiente",
  "seta vermelha apontando",
  "triângulo amarelo de alerta",
];

export function Composer({
  state,
  set,
  personas,
  mode,
  onModeChange,
  onGenerate,
  generating,
  progress,
  stage,
  analysis,
  isAnalyzing,
  onUploadCompetitor,
  onFetchUrl,
  onClearCompetitor,
  textSwaps,
  objectSwaps,
  setTextSwaps,
  setObjectSwaps,
  onApplySuggestions,
}: {
  state: ComposerState;
  set: (patch: Partial<ComposerState>) => void;
  personas: Persona[];
  mode: ComposerMode;
  onModeChange: (m: ComposerMode) => void;
  onGenerate: () => void;
  generating: boolean;
  progress: number;
  stage: string;
  analysis: AnalysisResult | null;
  isAnalyzing: boolean;
  onUploadCompetitor: (file: File) => Promise<void>;
  onFetchUrl: (url: string) => Promise<void>;
  onClearCompetitor: () => void;
  textSwaps: TextSwap[];
  objectSwaps: ObjectSwap[];
  setTextSwaps: (s: TextSwap[]) => void;
  setObjectSwaps: (s: ObjectSwap[]) => void;
  onApplySuggestions: (a: AnalysisResult) => void;
}) {
  void onApplySuggestions; // exposed for parent symmetry; UI uses analysis directly
  const tab: ComposerMode | "face" = mode;

  const fileRef = React.useRef<HTMLInputElement>(null);
  const [urlInput, setUrlInput] = React.useState("");
  const { data: health } = useHealth();

  const persona = personas.find((p) => p.id === state.personaId) ?? null;

  const fetchMut = useMutation({
    mutationFn: async (u: string) => onFetchUrl(u),
  });
  const uploadMut = useMutation({
    mutationFn: async (f: File) => onUploadCompetitor(f),
  });

  const isReady =
    !generating &&
    (mode === "remodel"
      ? !!state.competitorPath && (textSwaps.length > 0 || objectSwaps.length > 0)
      : state.prompt.trim().length > 4);
  // Persona é OPCIONAL em from-scratch (usuário pode gerar sem fixar face).

  const tabs: Array<{ id: ComposerMode | "face"; label: string; pip?: string; disabled?: boolean }> = [
    { id: "from-scratch", label: "Gerar do zero", },
    { id: "remodel", label: "Recriar viral", pip: state.competitorPath ? "ATIVO" : undefined },
    { id: "face", label: "Face swap", disabled: true },
  ];

  // Persona chip options — primeira opção é "Sem persona" (sentinel "__none__")
  const personaOptions: ChipOption<string>[] = [
    {
      value: "__none__",
      label: "Sem persona",
      meta: "gerar do zero, sem face fixa",
      avatar: <NoPersonaAvatar size="md" />,
    },
    ...personas.map((p) => ({
      value: p.id,
      label: p.name,
      meta: `${p.channel ?? "—"} · ${p.stylePaths.length} styles`,
      avatar: <PersonaAvatar persona={p} size="md" />,
    })),
  ];

  const engineOptions: ChipOption<EngineId>[] = [
    {
      value: "glabs",
      label: "G-Labs · Nano Banana Pro",
      meta: `${health?.glabs === "up" ? "online" : "offline"} · Chrome/extensão ou túnel Tailscale`,
      avatar: <EngineMonogram id="glabs" />,
    },
    {
      // Passa pelo mesmo G-Labs (host e API key), em rota própria:
      // /api/openai/generate. Depende de uma conta ChatGPT logada na extensão.
      value: "gpt-image-2",
      label: "GPT Image 2.0",
      meta: `${health?.glabs === "up" ? "online" : "offline"} · exige ChatGPT pago · máx. 5 refs`,
      avatar: <EngineMonogram id="gpt-image-2" />,
    },
  ];

  const variantOptions: ChipOption<number>[] = [1, 2, 3, 4].map((n) => ({
    value: n,
    label: String(n),
    meta: `${n} variant${n > 1 ? "es" : "e"}`,
  }));

  const ratioOptions: ChipOption<"16:9" | "9:16">[] = [
    { value: "16:9", label: "16:9", meta: "YouTube · 1920×1080" },
    { value: "9:16", label: "9:16", meta: "Shorts · 1080×1920" },
  ];

  const handleAddHint = (h: string) => {
    set({ prompt: state.prompt + (state.prompt ? ". " : "") + h });
  };

  return (
    <section className="relative z-[1] mx-auto mt-4 max-w-[920px] px-8">
      <div
        className="composer-glow relative overflow-hidden rounded-[20px] border border-[var(--line-3)] backdrop-blur-xl"
        style={{
          background:
            "linear-gradient(180deg, rgba(20,20,26,.95) 0%, rgba(11,11,15,.98) 100%)",
          boxShadow:
            "0 0 0 1px rgba(255,255,255,.03) inset, 0 30px 80px rgba(0,0,0,.6), 0 0 80px rgba(198,242,78,.04)",
        }}
      >
        {/* Tab strip */}
        <div className="flex border-b border-[var(--line)] bg-black/40 p-2">
          {tabs.map((t) => {
            const isActive = tab === t.id;
            return (
              <button
                key={t.id}
                disabled={t.disabled}
                onClick={() => {
                  if (t.disabled) return;
                  if (t.id === "from-scratch" || t.id === "remodel") {
                    onModeChange(t.id);
                  }
                }}
                title={t.disabled ? "Em breve" : undefined}
                className={cn(
                  "relative flex items-center gap-2 rounded-[10px] px-4 py-2.5 text-[13px] font-medium transition-all",
                  isActive
                    ? "bg-[var(--bg-3)] text-[var(--ink)] shadow-[inset_0_0_0_1px_var(--line-3),0_1px_0_rgba(255,255,255,.03)]"
                    : "text-[var(--ink-3)] hover:bg-white/[0.025] hover:text-[var(--ink-2)]",
                  t.disabled && "opacity-30 cursor-not-allowed"
                )}
              >
                {t.id === "from-scratch" && <Sparkles className="size-3.5" />}
                {t.id === "remodel" && <RefreshCw className="size-3.5" />}
                {t.id === "face" && <User className="size-3.5" />}
                {t.label}
                {t.pip && (
                  <span
                    className="rounded font-mono text-[9px] font-bold tracking-[0.04em]"
                    style={{
                      background: "var(--grad-cta)",
                      color: "#050507",
                      padding: "1px 5px",
                    }}
                  >
                    {t.pip}
                  </span>
                )}
              </button>
            );
          })}
          <span className="flex-1" />
          <span className="flex items-center gap-2 px-3 font-mono text-[10.5px] tracking-[0.04em] text-[var(--ink-4)]">
            <span>atalho</span>
            <kbd className="rounded border border-[var(--line-2)] bg-[var(--bg-3)] px-1.5 py-0.5 text-[10px] text-[var(--ink-2)]">
              ⌘ ↵
            </kbd>
          </span>
        </div>

        {/* Body */}
        <div className="space-y-3.5 px-6 pb-3.5 pt-5">
          {mode === "remodel" && (
            <>
              <CompetitorAttachments
                path={state.competitorPath}
                url={state.competitorUrl}
                urlInput={urlInput}
                setUrlInput={setUrlInput}
                isAnalyzing={isAnalyzing}
                isFetching={fetchMut.isPending}
                isUploading={uploadMut.isPending}
                onFetch={() => urlInput.trim() && fetchMut.mutate(urlInput.trim())}
                onPickFile={() => fileRef.current?.click()}
                onClear={onClearCompetitor}
              />
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) uploadMut.mutate(f);
                  e.target.value = "";
                }}
              />
            </>
          )}

          <div className="relative">
            <textarea
              className={cn(
                "display w-full resize-none bg-transparent text-[19px] leading-[1.45] tracking-[-0.02em] text-[var(--ink)] outline-none placeholder:text-[var(--ink-4)]",
                mode === "from-scratch" && "pr-14"
              )}
              style={{ minHeight: 96 }}
              placeholder={
                mode === "remodel"
                  ? "(Opcional) Instruções extras pra o remodel — ex: aumentar saturação do amarelo, adicionar selo de aprovação"
                  : "Descreva sua thumbnail. Ex: homem de jaleco verde, mão estendida sobre frigideira escorrendo gordura amarela, vermelho saturado, drama documental…"
              }
              value={mode === "remodel" ? state.extra : state.prompt}
              onChange={(e) =>
                mode === "remodel"
                  ? set({ extra: e.target.value })
                  : set({ prompt: e.target.value })
              }
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                  e.preventDefault();
                  onGenerate();
                }
              }}
            />
            {mode === "from-scratch" && (
              <PromptAssistButton
                draft={state.prompt}
                personaName={persona?.name ?? null}
                onSuggestion={(s) => set({ prompt: s })}
              />
            )}
          </div>

          {mode === "from-scratch" && (
            <div className="flex flex-wrap gap-1.5">
              {HINT_OPTIONS.map((h) => (
                <button
                  key={h}
                  onClick={() => handleAddHint(h)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[var(--line-2)] bg-white/[0.04] px-2.5 py-1 font-mono text-[11.5px] text-[var(--ink-2)] transition-all hover:border-[var(--accent)] hover:bg-[var(--accent)]/10 hover:text-[var(--accent)]"
                >
                  <Plus className="size-3 text-[var(--ink-4)]" />
                  {h}
                </button>
              ))}
            </div>
          )}

          {mode === "remodel" && (
            <RemodelSwaps
              analysis={analysis}
              isAnalyzing={isAnalyzing}
              textSwaps={textSwaps}
              objectSwaps={objectSwaps}
              setTextSwaps={setTextSwaps}
              setObjectSwaps={setObjectSwaps}
            />
          )}
        </div>

        {/* Foot — chips + CTA */}
        <div className="flex flex-wrap items-center gap-2 border-t border-[var(--line)] bg-black/40 px-3.5 py-3">
          <Chip
            label="Persona"
            value={state.personaId ?? "__none__"}
            options={personaOptions}
            onChange={(v) => set({ personaId: v === "__none__" ? null : v })}
            leadingAvatar={
              persona ? (
                <PersonaAvatar persona={persona} size="sm" />
              ) : (
                <NoPersonaAvatar size="sm" />
              )
            }
            popoverFooter="SELECIONAR PERSONA"
            width={320}
          />
          <Chip
            label="Engine"
            value={state.engine}
            options={engineOptions}
            onChange={(v) => set({ engine: v })}
            popoverFooter="MOTOR"
            width={310}
          />
          <Chip
            label="Variantes"
            value={state.variants}
            options={variantOptions}
            onChange={(v) => set({ variants: v as 1 | 2 | 3 | 4 })}
            popoverFooter="QUANTAS?"
            variantGrid
            width={240}
          />
          <Chip
            label="Ratio"
            value={state.ratio}
            options={ratioOptions}
            onChange={(v) => set({ ratio: v })}
            popoverFooter="PROPORÇÃO"
            width={220}
          />

          <span className="flex-1" />

          <button
            onClick={onGenerate}
            disabled={!isReady}
            className={cn(
              "relative inline-flex items-center gap-2.5 rounded-[10px] px-5 py-3 display text-[14px] font-bold tracking-[-0.01em]",
              "cta-vibrant"
            )}
          >
            {generating ? (
              <>
                <Zap className="size-4" />
                <span>Gerando… {Math.round(progress)}%</span>
                <span className="ml-2 truncate font-mono text-[10px] uppercase tracking-[0.1em] opacity-75">
                  {stage}
                </span>
                <div
                  className="absolute bottom-0 left-0 h-1 bg-black/40 transition-[width] duration-150"
                  style={{ width: `${progress}%` }}
                />
              </>
            ) : (
              <>
                <Zap className="size-4" />
                <span>
                  Gerar {state.variants}{" "}
                  {state.variants > 1 ? "variantes" : "variante"}
                </span>
                <kbd
                  className="rounded border px-1.5 py-0.5 font-mono text-[11px] font-bold"
                  style={{
                    background: "rgba(0,0,0,.18)",
                    borderColor: "rgba(0,0,0,.28)",
                  }}
                >
                  ⌘ ↵
                </kbd>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Quick actions (Título / Extra) — only useful in from-scratch mode */}
      {mode === "from-scratch" && <QuickActionsRow state={state} set={set} />}

      {/* Persona missing face warning */}
      {persona && !persona.facePath && (
        <div className="mt-3 inline-flex items-center gap-2 rounded-md border border-[var(--danger)]/30 bg-[var(--danger)]/10 px-3 py-2 text-xs text-[var(--danger)]">
          <AlertCircle className="size-3.5 shrink-0" />
          <span>
            Persona <b>{persona.name}</b> sem face.{" "}
            <Link href={`/personas/${persona.id}`} className="underline">
              Adicione aqui.
            </Link>
          </span>
        </div>
      )}
    </section>
  );
}

// ─── Sub-components ────────────────────────────────────────────────

function PersonaAvatar({
  persona,
  size,
}: {
  persona: Persona;
  size: "sm" | "md";
}) {
  const px = size === "sm" ? "size-[22px] text-[10px]" : "size-[30px] text-[11px]";
  const initials = persona.name
    .split(" ")
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
  return persona.facePath ? (
    <span className={cn("relative shrink-0 overflow-hidden rounded-md", px)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={fileUrl(persona.facePath)}
        alt={persona.name}
        className="size-full object-cover"
      />
    </span>
  ) : (
    <span
      className={cn(
        "grid shrink-0 place-items-center rounded-md bg-[var(--bg-4)] font-bold text-white",
        px
      )}
    >
      {initials || persona.name[0]?.toUpperCase()}
    </span>
  );
}

function NoPersonaAvatar({ size }: { size: "sm" | "md" }) {
  const px = size === "sm" ? "size-[22px]" : "size-[30px]";
  const icon = size === "sm" ? "size-3" : "size-4";
  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center rounded-md border border-dashed border-[var(--line-3)] bg-[var(--bg-3)] text-[var(--ink-3)]",
        px
      )}
    >
      <UserX className={icon} />
    </span>
  );
}

// ─── Prompt Assist Button ────────────────────────────────────────

function PromptAssistButton({
  draft,
  personaName,
  onSuggestion,
}: {
  draft: string;
  personaName: string | null;
  onSuggestion: (s: string) => void;
}) {
  const mut = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/prompt-suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          draft: draft || undefined,
          personaName: personaName || undefined,
        }),
      });
      const json = await r.json();
      if (!r.ok) throw new Error(json.error ?? "Falha");
      return json.suggestion as string;
    },
    onSuccess: (suggestion) => {
      onSuggestion(suggestion);
      toast.success("Prompt enriquecido pela IA");
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <button
      type="button"
      onClick={() => mut.mutate()}
      disabled={mut.isPending}
      title="Pedir ajuda à IA pra escrever esse prompt"
      aria-label="Prompt Assist (IA)"
      className="prompt-assist-btn absolute right-0 top-0"
    >
      {mut.isPending ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <Wand2 className="size-4" />
      )}
    </button>
  );
}

function EngineMonogram({ id }: { id: EngineId }) {
  return (
    <span
      className="grid size-[30px] shrink-0 place-items-center rounded-md font-bold text-[#050507]"
      style={{
        background:
          id === "glabs"
            ? "var(--grad-cta)"
            : "linear-gradient(135deg, #6B7280, #1F2937)",
        fontSize: 11,
      }}
    >
      {id === "glabs" ? "GL" : "G2"}
    </span>
  );
}

function CompetitorAttachments({
  path,
  url,
  urlInput,
  setUrlInput,
  isAnalyzing,
  isFetching,
  isUploading,
  onFetch,
  onPickFile,
  onClear,
}: {
  path: string | null;
  url: string | null;
  urlInput: string;
  setUrlInput: (s: string) => void;
  isAnalyzing: boolean;
  isFetching: boolean;
  isUploading: boolean;
  onFetch: () => void;
  onPickFile: () => void;
  onClear: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {path ? (
        <div className="relative size-16 overflow-hidden rounded-[10px] border border-[var(--line-3)] bg-[var(--bg-3)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={fileUrl(path)} alt="ref" className="size-full object-cover" />
          <button
            onClick={onClear}
            className="absolute right-1 top-1 grid size-[18px] place-items-center rounded-full border border-white/20 bg-black/85 text-[10px] text-white"
            aria-label="Remover ref"
          >
            <X className="size-2.5" />
          </button>
          {isAnalyzing && (
            <div className="absolute inset-0 grid place-items-center bg-black/65">
              <Loader2 className="size-4 animate-spin" style={{ color: "var(--accent)" }} />
            </div>
          )}
        </div>
      ) : null}

      <button
        onClick={onPickFile}
        disabled={isUploading}
        className="grid size-16 place-items-center rounded-[10px] border border-dashed border-[var(--line-3)] bg-white/[0.015] text-[var(--ink-3)] transition-all hover:border-[var(--accent)] hover:bg-[var(--accent)]/[0.06] hover:text-[var(--accent)] disabled:opacity-50"
        title="Anexar imagem"
      >
        {isUploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
      </button>

      <div className="flex flex-1 items-center gap-1.5 rounded-[10px] border border-[var(--line-2)] bg-white/[0.02] px-2.5 py-1.5">
        <Search className="size-3.5 text-[var(--ink-4)]" />
        <input
          value={urlInput}
          onChange={(e) => setUrlInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && urlInput.trim() && !isFetching) {
              e.preventDefault();
              onFetch();
            }
          }}
          placeholder="ou cole URL do YouTube concorrente…"
          className="flex-1 bg-transparent font-mono text-[12px] text-[var(--ink)] outline-none placeholder:text-[var(--ink-4)]"
        />
        {urlInput.trim() && (
          <button
            onClick={onFetch}
            disabled={isFetching}
            className="rounded-md bg-[var(--bg-3)] px-2 py-1 text-[11px] font-medium text-[var(--ink-2)] hover:bg-[var(--bg-4)] hover:text-[var(--ink)] disabled:opacity-50"
          >
            {isFetching ? <Loader2 className="size-3 animate-spin" /> : "Buscar"}
          </button>
        )}
        {url && !urlInput && (
          <span className="truncate font-mono text-[10px] text-[var(--ink-4)]">
            {url.replace(/^https?:\/\//, "").slice(0, 28)}
          </span>
        )}
      </div>
    </div>
  );
}

function QuickActionsRow({
  state,
  set,
}: {
  state: ComposerState;
  set: (patch: Partial<ComposerState>) => void;
}) {
  const [editingTitle, setEditingTitle] = React.useState(false);
  const [editingNeg, setEditingNeg] = React.useState(false);
  return (
    <div className="mx-auto mt-3.5 flex flex-wrap items-center justify-center gap-2 px-8">
      {editingTitle ? (
        <input
          autoFocus
          value={state.title}
          onChange={(e) => set({ title: e.target.value })}
          onBlur={() => setEditingTitle(false)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === "Escape") setEditingTitle(false);
          }}
          placeholder="Título da thumb"
          className="rounded-full border border-[var(--accent)]/40 bg-[var(--accent)]/5 px-3.5 py-1.5 font-mono text-[12px] tracking-[0.02em] text-[var(--ink)] outline-none placeholder:text-[var(--ink-4)]"
          style={{ minWidth: 280 }}
        />
      ) : (
        <button
          onClick={() => setEditingTitle(true)}
          className="inline-flex items-center gap-2 rounded-full border border-[var(--line-2)] bg-white/[0.03] px-3 py-1.5 font-mono text-[12px] tracking-[0.02em] text-[var(--ink-2)] transition-all hover:border-[var(--line-3)] hover:bg-white/[0.06] hover:text-[var(--ink)]"
        >
          <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--ink-4)]">
            Título
          </span>
          <b className="font-semibold text-[var(--ink)]">
            {state.title?.trim()
              ? state.title.length > 36
                ? state.title.slice(0, 33) + "…"
                : state.title
              : "sem título"}
          </b>
          <Pencil className="size-3 text-[var(--ink-3)]" />
        </button>
      )}

      {editingNeg ? (
        <input
          autoFocus
          value={state.extra}
          onChange={(e) => set({ extra: e.target.value })}
          onBlur={() => setEditingNeg(false)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === "Escape") setEditingNeg(false);
          }}
          placeholder="o que evitar — ex: borrado, deformado"
          className="rounded-full border border-[var(--line-3)] bg-white/[0.03] px-3.5 py-1.5 font-mono text-[12px] tracking-[0.02em] text-[var(--ink)] outline-none"
          style={{ minWidth: 280 }}
        />
      ) : (
        <button
          onClick={() => setEditingNeg(true)}
          className="inline-flex items-center gap-2 rounded-full border border-[var(--line-2)] bg-white/[0.03] px-3 py-1.5 font-mono text-[12px] tracking-[0.02em] text-[var(--ink-2)] transition-all hover:border-[var(--line-3)] hover:bg-white/[0.06] hover:text-[var(--ink)]"
        >
          <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--ink-4)]">
            Extra
          </span>
          <b className="font-semibold text-[var(--ink)]">
            {state.extra?.trim() ? state.extra.slice(0, 28) : "—"}
          </b>
          <Plus className="size-3 text-[var(--ink-3)]" />
        </button>
      )}
    </div>
  );
}

// ─── Remodel swaps (compact, fits inside composer body) ────────────

function RemodelSwaps({
  analysis,
  isAnalyzing,
  textSwaps,
  objectSwaps,
  setTextSwaps,
  setObjectSwaps,
}: {
  analysis: AnalysisResult | null;
  isAnalyzing: boolean;
  textSwaps: TextSwap[];
  objectSwaps: ObjectSwap[];
  setTextSwaps: (s: TextSwap[]) => void;
  setObjectSwaps: (s: ObjectSwap[]) => void;
}) {
  if (isAnalyzing) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-[var(--accent)]/30 bg-[var(--accent)]/5 px-4 py-3">
        <Loader2 className="size-4 animate-spin" style={{ color: "var(--accent)" }} />
        <div>
          <p className="text-[13px] font-semibold" style={{ color: "var(--accent)" }}>
            Lendo a thumbnail concorrente
          </p>
          <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--ink-3)]">
            text · colors · objects · composition
          </p>
        </div>
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="rounded-lg border border-[var(--line-2)] bg-white/[0.02] px-4 py-3 text-center">
        <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--ink-3)]">
          Aguardando análise
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-lg border border-[var(--line-2)] bg-white/[0.02] p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--ink-3)]">
          <ScanText className="size-3" style={{ color: "var(--accent)" }} />
          <span>Análise · troque o que precisar</span>
        </div>
        <div className="flex flex-wrap gap-1">
          {analysis.dominantColors.slice(0, 5).map((c, i) => (
            <span
              key={i}
              className="size-3.5 rounded-sm ring-1 ring-[var(--line-2)]"
              style={{ backgroundColor: c.hex }}
              title={`${c.hex} · ${c.name}`}
            />
          ))}
        </div>
      </div>

      <SwapList
        kind="text"
        icon={<Type className="size-3.5" />}
        label="Texto"
        swaps={textSwaps}
        setSwaps={setTextSwaps}
      />
      <SwapList
        kind="object"
        icon={<Box className="size-3.5" />}
        label="Objetos"
        swaps={objectSwaps as unknown as TextSwap[]}
        setSwaps={(s) => setObjectSwaps(s as unknown as ObjectSwap[])}
      />
    </div>
  );
}

function SwapList({
  kind,
  icon,
  label,
  swaps,
  setSwaps,
}: {
  kind: "text" | "object";
  icon: React.ReactNode;
  label: string;
  swaps: TextSwap[];
  setSwaps: (s: TextSwap[]) => void;
}) {
  const update = (i: number, patch: Partial<TextSwap>) =>
    setSwaps(swaps.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  const remove = (i: number) => setSwaps(swaps.filter((_, idx) => idx !== i));
  const add = () => setSwaps([...swaps, { original: "", action: "replace", replacement: "" }]);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--ink-3)]">
          {icon}
          {label}{" "}
          <b className="font-semibold text-[var(--ink-2)]">{swaps.length}</b>
        </span>
        <button
          onClick={add}
          className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--ink-3)] hover:text-[var(--accent)]"
        >
          + add
        </button>
      </div>
      {swaps.length > 0 && (
        <ul className="space-y-1">
          {swaps.map((s, i) => (
            <li
              key={i}
              className="grid items-center gap-2 rounded-md border border-[var(--line-2)] bg-[var(--bg-3)] px-2 py-1.5"
              style={{ gridTemplateColumns: "minmax(0,1fr) auto auto" }}
            >
              <div className="flex items-center gap-2 overflow-hidden">
                <span className="truncate text-[12px] font-medium text-[var(--ink)]">
                  {s.original || (
                    <span className="italic text-[var(--ink-4)]">
                      {kind === "text" ? "(texto)" : "(objeto)"}
                    </span>
                  )}
                </span>
                {s.action === "replace" && (
                  <>
                    <span className="text-[var(--ink-4)]">→</span>
                    <input
                      value={s.replacement ?? ""}
                      onChange={(e) =>
                        update(i, { replacement: e.target.value })
                      }
                      placeholder="sua versão"
                      className="min-w-0 flex-1 border-b border-dashed border-[var(--line-2)] bg-transparent text-[12px] text-[var(--ink)] outline-none placeholder:text-[var(--ink-4)] focus:border-[var(--accent)]"
                    />
                  </>
                )}
                {!s.original && (
                  <input
                    value={s.original}
                    onChange={(e) => update(i, { original: e.target.value })}
                    placeholder={kind === "text" ? "texto original" : "objeto original"}
                    className="min-w-0 flex-1 border-b border-dashed border-[var(--line-2)] bg-transparent text-[12px] text-[var(--ink)] outline-none placeholder:text-[var(--ink-4)] focus:border-[var(--accent)]"
                  />
                )}
              </div>
              <ActionMini value={s.action} onChange={(a) => update(i, { action: a })} />
              <button
                onClick={() => remove(i)}
                className="grid size-6 place-items-center rounded text-[var(--ink-3)] hover:bg-[var(--danger)]/10 hover:text-[var(--danger)]"
              >
                <Trash2 className="size-3" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ActionMini({
  value,
  onChange,
}: {
  value: SwapAction;
  onChange: (a: SwapAction) => void;
}) {
  const items: Array<{ id: SwapAction; icon: React.ReactNode; title: string }> = [
    { id: "replace", icon: <Pencil className="size-3" />, title: "Trocar" },
    { id: "keep", icon: <CheckCircle2 className="size-3" />, title: "Manter" },
    { id: "remove", icon: <Trash2 className="size-3" />, title: "Remover" },
  ];
  return (
    <div className="inline-flex rounded-md border border-[var(--line-2)] bg-[var(--bg-2)] p-0.5">
      {items.map((it) => (
        <button
          key={it.id}
          onClick={() => onChange(it.id)}
          title={it.title}
          className={cn(
            "grid size-6 place-items-center rounded transition-colors",
            value === it.id
              ? "bg-[var(--accent)] text-[#050507]"
              : "text-[var(--ink-3)] hover:text-[var(--ink)]"
          )}
        >
          {it.icon}
        </button>
      ))}
    </div>
  );
}

export function applySuggestionsToComposer(
  analysis: AnalysisResult,
  set: (p: Partial<ComposerState>) => void
) {
  if (analysis.suggestedHeadlineMainWhite) {
    set({ title: analysis.suggestedHeadlineMainWhite });
  } else if (analysis.suggestedHeadlineTop) {
    set({ title: analysis.suggestedHeadlineTop });
  }
  if (analysis.suggestedConcept) {
    set({ prompt: analysis.suggestedConcept });
  }
}
