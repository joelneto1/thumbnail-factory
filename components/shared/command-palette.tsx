"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Search, Wand2, Users, History, Settings as SettingsIcon, ImageIcon } from "lucide-react";

import { cn } from "@/lib/utils";

interface PaletteContextValue {
  open: () => void;
  close: () => void;
  toggle: () => void;
}

const Ctx = React.createContext<PaletteContextValue>({
  open: () => {},
  close: () => {},
  toggle: () => {},
});

export function useCommandPalette() {
  return React.useContext(Ctx);
}

interface CommandItem {
  id: string;
  label: string;
  hint: string;
  icon: React.ComponentType<{ className?: string }>;
  action: () => void;
}

export function CommandPaletteProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isOpen, setOpen] = React.useState(false);
  const [q, setQ] = React.useState("");
  const [idx, setIdx] = React.useState(0);
  const router = useRouter();

  const open = React.useCallback(() => setOpen(true), []);
  const close = React.useCallback(() => setOpen(false), []);
  const toggle = React.useCallback(() => setOpen((v) => !v), []);

  const items: CommandItem[] = React.useMemo(
    () => [
      {
        id: "workbench",
        label: "Ir pro Workbench",
        hint: "G W",
        icon: Wand2,
        action: () => router.push("/"),
      },
      {
        id: "personas",
        label: "Personas",
        hint: "G P",
        icon: Users,
        action: () => router.push("/personas"),
      },
      {
        id: "history",
        label: "Histórico",
        hint: "G H",
        icon: History,
        action: () => router.push("/history"),
      },
      {
        id: "settings",
        label: "Settings",
        hint: "G S",
        icon: SettingsIcon,
        action: () => router.push("/settings"),
      },
      {
        id: "new-persona",
        label: "Nova persona",
        hint: "N P",
        icon: ImageIcon,
        action: () => router.push("/personas"),
      },
    ],
    [router]
  );

  const filtered = React.useMemo(
    () => items.filter((i) => i.label.toLowerCase().includes(q.toLowerCase())),
    [items, q]
  );

  React.useEffect(() => {
    if (isOpen) {
      setQ("");
      setIdx(0);
    }
  }, [isOpen]);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key.toLowerCase() === "k") {
        e.preventDefault();
        toggle();
        return;
      }
      if (!isOpen) return;
      if (e.key === "Escape") {
        e.preventDefault();
        close();
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setIdx((i) => Math.min(filtered.length - 1, i + 1));
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setIdx((i) => Math.max(0, i - 1));
      }
      if (e.key === "Enter") {
        e.preventDefault();
        const it = filtered[idx];
        if (it) {
          it.action();
          close();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, idx, filtered, toggle, close]);

  const value: PaletteContextValue = { open, close, toggle };

  return (
    <Ctx.Provider value={value}>
      {children}
      {isOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-start justify-center bg-black/60 px-4 pt-[18vh] backdrop-blur-sm"
          onClick={close}
        >
          <div
            className="w-full max-w-xl overflow-hidden rounded-xl border border-[var(--line-3)] bg-[var(--bg-2)] shadow-[0_24px_60px_rgba(0,0,0,.7)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 border-b border-[var(--line)] px-4 py-3">
              <Search className="size-4 text-[var(--ink-3)]" />
              <input
                autoFocus
                className="flex-1 bg-transparent text-[15px] text-[var(--ink)] placeholder:text-[var(--ink-4)] outline-none"
                placeholder="Buscar comandos…"
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setIdx(0);
                }}
              />
              <kbd className="rounded border border-[var(--line-2)] bg-[var(--bg-3)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--ink-3)]">
                esc
              </kbd>
            </div>
            <div className="max-h-[50vh] overflow-y-auto p-1 scrollbar-thin">
              {filtered.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-[var(--ink-3)]">
                  Sem resultados.
                </p>
              ) : (
                filtered.map((it, i) => (
                  <button
                    key={it.id}
                    onMouseEnter={() => setIdx(i)}
                    onClick={() => {
                      it.action();
                      close();
                    }}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[13px] transition-colors",
                      i === idx
                        ? "bg-[var(--bg-3)] text-[var(--ink)]"
                        : "text-[var(--ink-2)]"
                    )}
                  >
                    <it.icon className="size-4 text-[var(--ink-3)]" />
                    <span className="flex-1">{it.label}</span>
                    <kbd className="rounded border border-[var(--line-2)] bg-[var(--bg-3)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--ink-3)]">
                      {it.hint}
                    </kbd>
                  </button>
                ))
              )}
            </div>
            <div className="flex items-center justify-between border-t border-[var(--line)] px-4 py-2 font-mono text-[10px] uppercase tracking-wider text-[var(--ink-4)]">
              <span>↑↓ navegar</span>
              <span>↵ executar</span>
              <span>esc fechar</span>
            </div>
          </div>
        </div>
      )}
    </Ctx.Provider>
  );
}
