"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Eye, EyeOff, CheckCircle2, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type SourceInfo = {
  value: string;
  masked: string;
  source: "db" | "env" | "default" | "missing";
};

interface SettingsStatus {
  glabsBaseUrl: SourceInfo;
  glabsApiKey: SourceInfo;
  cliProxyBaseUrl: SourceInfo;
  cliProxyApiKey: SourceInfo;
  cliProxyModel: SourceInfo;
  cliProxyReasoningEffort: SourceInfo;
}

interface SavePayload {
  glabsBaseUrl?: string;
  glabsApiKey?: string;
  cliProxyBaseUrl?: string;
  cliProxyApiKey?: string;
  cliProxyModel?: string;
  cliProxyReasoningEffort?: string;
}

function SourceBadge({ source }: { source: SourceInfo["source"] }) {
  if (source === "db") return <Badge variant="success">saved</Badge>;
  if (source === "env") return <Badge variant="secondary">.env.local</Badge>;
  if (source === "default") return <Badge variant="outline">default</Badge>;
  return <Badge variant="destructive">missing</Badge>;
}

export default function SettingsPage() {
  const qc = useQueryClient();

  const { data, isLoading } = useQuery<{ settings: SettingsStatus }>({
    queryKey: ["settings"],
    queryFn: async () => {
      const r = await fetch("/api/settings", { cache: "no-store" });
      if (!r.ok) throw new Error("Falha");
      return r.json();
    },
  });

  const [glabsBaseUrl, setGlabsBaseUrl] = React.useState("");
  const [glabsApiKey, setGlabsApiKey] = React.useState("");
  const [cliProxyBaseUrl, setCliProxyBaseUrl] = React.useState("");
  const [cliProxyApiKey, setCliProxyApiKey] = React.useState("");
  const [cliProxyModel, setCliProxyModel] = React.useState("");
  const [cliProxyReasoning, setCliProxyReasoning] = React.useState("");
  const [showGlabs, setShowGlabs] = React.useState(false);
  const [showCliProxy, setShowCliProxy] = React.useState(false);

  React.useEffect(() => {
    if (data?.settings) {
      setGlabsBaseUrl(data.settings.glabsBaseUrl.value || "");
      setCliProxyBaseUrl(data.settings.cliProxyBaseUrl.value || "");
      setCliProxyModel(data.settings.cliProxyModel.value || "");
      setCliProxyReasoning(data.settings.cliProxyReasoningEffort.value || "");
    }
  }, [data?.settings]);

  const save = useMutation({
    mutationFn: async (payload: SavePayload) => {
      const r = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!r.ok) throw new Error("Falha");
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["settings"] });
      qc.invalidateQueries({ queryKey: ["health"] });
      toast.success("Settings atualizadas");
      setGlabsApiKey("");
      setCliProxyApiKey("");
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const test = useMutation({
    mutationFn: async (engine: "glabs" | "claude") => {
      const r = await fetch("/api/settings/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ engine }),
      });
      const json = (await r.json()) as { ok: boolean; detail: string };
      return { engine, ...json };
    },
    onSuccess: (result) => {
      if (result.ok) toast.success(result.detail);
      else toast.error(result.detail);
    },
  });

  const handleSaveAll = () => {
    const payload: SavePayload = {};
    if (glabsBaseUrl !== (data?.settings.glabsBaseUrl.value ?? "")) {
      payload.glabsBaseUrl = glabsBaseUrl;
    }
    if (glabsApiKey) payload.glabsApiKey = glabsApiKey;
    if (cliProxyBaseUrl !== (data?.settings.cliProxyBaseUrl.value ?? "")) {
      payload.cliProxyBaseUrl = cliProxyBaseUrl;
    }
    if (cliProxyApiKey) payload.cliProxyApiKey = cliProxyApiKey;
    if (cliProxyModel !== (data?.settings.cliProxyModel.value ?? "")) {
      payload.cliProxyModel = cliProxyModel;
    }
    if (
      cliProxyReasoning !== (data?.settings.cliProxyReasoningEffort.value ?? "")
    ) {
      payload.cliProxyReasoningEffort = cliProxyReasoning;
    }
    if (Object.keys(payload).length === 0) {
      toast.message("Nada pra salvar");
      return;
    }
    save.mutate(payload);
  };

  return (
    <div className="mx-auto max-w-3xl px-8 py-14">
      <header className="mb-10 space-y-2">
        <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-[var(--ink-3)]">
          Atelier · Settings
        </p>
        <h1 className="display text-[clamp(34px,5vw,56px)] font-bold leading-[1] tracking-[-0.02em] text-[var(--ink)]">
          <span className="italic">Workshop</span> settings
        </h1>
        <p className="max-w-[520px] text-[14px] leading-[1.5] text-[var(--ink-3)]">
          Chaves de API e endpoints. Salvas no SQLite local —{" "}
          <span className="font-semibold text-[var(--ink)]">
            o servidor lê em runtime
          </span>
          , sem precisar reiniciar.
        </p>
      </header>

      {isLoading ? (
        <div className="rounded-xl border border-[var(--line-2)] bg-[var(--bg-2)] p-6 text-sm text-[var(--ink-3)]">
          <Loader2 className="size-4 animate-spin" /> Carregando...
        </div>
      ) : (
        <div className="space-y-12">
          {/* G-LABS */}
          <section className="space-y-5">
            <div className="flex items-baseline justify-between border-b border-[var(--line)] pb-3">
              <div className="flex items-baseline gap-3">
                <span className="font-mono text-[11px] tracking-[0.12em] text-[var(--ink-3)]">
                  01
                </span>
                <h2 className="display text-[24px] font-semibold tracking-[-0.02em]">
                  G-Labs{" "}
                  <span className="italic font-normal text-[var(--ink-3)]">
                    — Nano Banana Pro (imagem)
                  </span>
                </h2>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => test.mutate("glabs")}
                disabled={test.isPending && test.variables === "glabs"}
              >
                {test.isPending && test.variables === "glabs" ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : test.data?.engine === "glabs" && test.data?.ok ? (
                  <CheckCircle2
                    className="size-4"
                    style={{ color: "var(--success)" }}
                  />
                ) : test.data?.engine === "glabs" && !test.data?.ok ? (
                  <XCircle className="size-4" style={{ color: "var(--danger)" }} />
                ) : null}
                Test connection
              </Button>
            </div>

            <div className="space-y-5">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label
                    htmlFor="glabs-url"
                    className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--ink-3)]"
                  >
                    Base URL
                  </Label>
                  <SourceBadge
                    source={data?.settings.glabsBaseUrl.source ?? "missing"}
                  />
                </div>
                <Input
                  id="glabs-url"
                  value={glabsBaseUrl}
                  onChange={(e) => setGlabsBaseUrl(e.target.value)}
                  placeholder="http://127.0.0.1:8765"
                  className="font-mono text-sm"
                />
                <p className="text-[11px] leading-relaxed text-[var(--ink-3)]">
                  Local:{" "}
                  <code className="text-[var(--ink-2)]">
                    http://127.0.0.1:8765
                  </code>{" "}
                  · VPS via Tailscale:{" "}
                  <code className="text-[var(--ink-2)]">
                    https://joel.tail739437.ts.net
                  </code>
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label
                    htmlFor="glabs-key"
                    className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--ink-3)]"
                  >
                    API Key
                  </Label>
                  <SourceBadge
                    source={data?.settings.glabsApiKey.source ?? "missing"}
                  />
                </div>
                <div className="flex gap-2">
                  <Input
                    id="glabs-key"
                    type={showGlabs ? "text" : "password"}
                    value={glabsApiKey}
                    onChange={(e) => setGlabsApiKey(e.target.value)}
                    placeholder={
                      data?.settings.glabsApiKey.masked
                        ? `Atual: ${data.settings.glabsApiKey.masked}`
                        : "Cole sua chave G-Labs"
                    }
                    className="font-mono text-sm"
                  />
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={() => setShowGlabs((v) => !v)}
                  >
                    {showGlabs ? (
                      <EyeOff className="size-4" />
                    ) : (
                      <Eye className="size-4" />
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </section>

          {/* CLI PROXY (CLAUDE) */}
          <section className="space-y-5">
            <div className="flex items-baseline justify-between border-b border-[var(--line)] pb-3">
              <div className="flex items-baseline gap-3">
                <span className="font-mono text-[11px] tracking-[0.12em] text-[var(--ink-3)]">
                  02
                </span>
                <h2 className="display text-[24px] font-semibold tracking-[-0.02em]">
                  CLI Proxy{" "}
                  <span className="italic font-normal text-[var(--ink-3)]">
                    — Claude Opus 4.8 (prompt assist + análise OCR)
                  </span>
                </h2>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => test.mutate("claude")}
                disabled={test.isPending && test.variables === "claude"}
              >
                {test.isPending && test.variables === "claude" ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : test.data?.engine === "claude" && test.data?.ok ? (
                  <CheckCircle2
                    className="size-4"
                    style={{ color: "var(--success)" }}
                  />
                ) : test.data?.engine === "claude" && !test.data?.ok ? (
                  <XCircle className="size-4" style={{ color: "var(--danger)" }} />
                ) : null}
                Test connection
              </Button>
            </div>

            <div className="space-y-5">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label
                    htmlFor="cli-url"
                    className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--ink-3)]"
                  >
                    Base URL
                  </Label>
                  <SourceBadge
                    source={data?.settings.cliProxyBaseUrl.source ?? "missing"}
                  />
                </div>
                <Input
                  id="cli-url"
                  value={cliProxyBaseUrl}
                  onChange={(e) => setCliProxyBaseUrl(e.target.value)}
                  placeholder="http://cli-proxyllm.rotaclubs.com/v1"
                  className="font-mono text-sm"
                />
                <p className="text-[11px] leading-relaxed text-[var(--ink-3)]">
                  Endpoint compatível com OpenAI —{" "}
                  <code className="text-[var(--ink-2)]">
                    {"{base}"}/chat/completions
                  </code>
                  .
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label
                    htmlFor="cli-key"
                    className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--ink-3)]"
                  >
                    API Key
                  </Label>
                  <SourceBadge
                    source={data?.settings.cliProxyApiKey.source ?? "missing"}
                  />
                </div>
                <div className="flex gap-2">
                  <Input
                    id="cli-key"
                    type={showCliProxy ? "text" : "password"}
                    value={cliProxyApiKey}
                    onChange={(e) => setCliProxyApiKey(e.target.value)}
                    placeholder={
                      data?.settings.cliProxyApiKey.masked
                        ? `Atual: ${data.settings.cliProxyApiKey.masked}`
                        : "Cole sua chave cpw_..."
                    }
                    className="font-mono text-sm"
                  />
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={() => setShowCliProxy((v) => !v)}
                  >
                    {showCliProxy ? (
                      <EyeOff className="size-4" />
                    ) : (
                      <Eye className="size-4" />
                    )}
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label
                      htmlFor="cli-model"
                      className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--ink-3)]"
                    >
                      Modelo
                    </Label>
                    <SourceBadge
                      source={data?.settings.cliProxyModel.source ?? "missing"}
                    />
                  </div>
                  <Input
                    id="cli-model"
                    value={cliProxyModel}
                    onChange={(e) => setCliProxyModel(e.target.value)}
                    placeholder="claude-opus-4-8"
                    className="font-mono text-sm"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label
                      htmlFor="cli-reasoning"
                      className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--ink-3)]"
                    >
                      Reasoning
                    </Label>
                    <SourceBadge
                      source={
                        data?.settings.cliProxyReasoningEffort.source ?? "missing"
                      }
                    />
                  </div>
                  <Input
                    id="cli-reasoning"
                    value={cliProxyReasoning}
                    onChange={(e) => setCliProxyReasoning(e.target.value)}
                    placeholder="none | low | medium | high"
                    className="font-mono text-sm"
                  />
                </div>
              </div>
            </div>
          </section>

          <div className="border-t border-[var(--line)] pt-6 flex items-center justify-between gap-6">
            <p className="text-[11px] leading-relaxed text-[var(--ink-3)]">
              Settings salvas no SQLite têm prioridade sobre{" "}
              <code className="text-[var(--ink-2)]">.env.local</code>.
            </p>
            <button
              onClick={handleSaveAll}
              disabled={save.isPending}
              className={cn(
                "inline-flex items-center gap-2.5 overflow-hidden rounded-[9px] px-5 py-3 display text-[14px] font-bold tracking-[-0.01em] text-[#050507] cta-shadow",
                save.isPending && "pointer-events-none opacity-50"
              )}
              style={{ background: "var(--grad-cta)" }}
            >
              {save.isPending && <Loader2 className="size-4 animate-spin" />}
              Save changes
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
