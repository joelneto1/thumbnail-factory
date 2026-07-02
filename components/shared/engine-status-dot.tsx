"use client";

import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { HealthStatus } from "@/lib/types";

export function useHealth() {
  return useQuery<HealthStatus>({
    queryKey: ["health"],
    queryFn: async () => {
      const r = await fetch("/api/health", { cache: "no-store" });
      if (!r.ok) throw new Error("Health check falhou");
      return r.json();
    },
    refetchInterval: 30_000,
    staleTime: 25_000,
  });
}

export function EngineStatusDot({
  engine,
  className,
}: {
  engine: "glabs" | "gemini";
  className?: string;
}) {
  const { data } = useHealth();
  let state: "ok" | "down" | "unknown" = "unknown";
  let label = "Carregando...";

  if (data) {
    if (engine === "glabs") {
      state = data.glabs === "up" ? "ok" : "down";
      label =
        data.glabs === "up"
          ? `G-Labs online (${data.glabsBaseUrl})`
          : `G-Labs offline em ${data.glabsBaseUrl}`;
    } else {
      state = data.gemini === "configured" ? "ok" : "down";
      label =
        data.gemini === "configured"
          ? "Gemini API configurada"
          : "GEMINI_API_KEY não definida";
    }
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="relative inline-flex">
          <span
            className={cn(
              "inline-block size-1.5 rounded-full transition-colors",
              state === "ok" && "bg-success",
              state === "down" && "bg-destructive",
              state === "unknown" && "bg-zinc-500",
              className
            )}
            aria-label={label}
          />
          {state === "ok" && (
            <span className="pulse-ring absolute inset-0 rounded-full text-success" />
          )}
        </span>
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  );
}
