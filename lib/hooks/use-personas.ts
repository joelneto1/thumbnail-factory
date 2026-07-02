"use client";

import { useQuery } from "@tanstack/react-query";
import type { Persona } from "@/lib/types";

export function usePersonas() {
  return useQuery<{ personas: Persona[] }>({
    queryKey: ["personas"],
    queryFn: async () => {
      const r = await fetch("/api/personas", { cache: "no-store" });
      if (!r.ok) throw new Error("Falha ao carregar personas");
      return r.json();
    },
  });
}

export function usePersona(id: string | null | undefined) {
  return useQuery<{ persona: Persona }>({
    queryKey: ["persona", id],
    queryFn: async () => {
      const r = await fetch(`/api/personas/${id}`, { cache: "no-store" });
      if (!r.ok) throw new Error("Persona não encontrada");
      return r.json();
    },
    enabled: !!id,
  });
}
