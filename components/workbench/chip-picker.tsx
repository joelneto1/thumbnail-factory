"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ChipOption<T extends string | number> {
  value: T;
  label: string;
  meta?: string;
  avatar?: React.ReactNode;
  disabled?: boolean;
  badge?: string;
}

export function Chip<T extends string | number>({
  label,
  value,
  options,
  onChange,
  align = "left",
  width,
  leadingAvatar,
  popoverFooter,
  variantGrid,
}: {
  label?: string;
  value: T;
  options: ChipOption<T>[];
  onChange: (v: T) => void;
  align?: "left" | "right";
  width?: number;
  leadingAvatar?: React.ReactNode;
  popoverFooter?: string;
  variantGrid?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const popoverRef = React.useRef<HTMLDivElement>(null);
  const [coords, setCoords] = React.useState<{
    top: number;
    left: number;
    right: number;
  } | null>(null);

  // Mede a posição do trigger sempre que abre (e em scroll/resize) para
  // que o popover (renderizado via portal no <body>) fique ancorado no botão.
  React.useEffect(() => {
    if (!open) return;
    const measure = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (rect) setCoords({ top: rect.top, left: rect.left, right: rect.right });
    };
    measure();
    window.addEventListener("scroll", measure, true);
    window.addEventListener("resize", measure);
    return () => {
      window.removeEventListener("scroll", measure, true);
      window.removeEventListener("resize", measure);
    };
  }, [open]);

  React.useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (popoverRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const current = options.find((o) => o.value === value) ?? options[0];

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "inline-flex items-center gap-2 rounded-[9px] border border-[var(--line-2)] bg-[var(--bg-3)] px-3 py-2 text-[12.5px] font-medium text-[var(--ink-2)] whitespace-nowrap transition-all",
          "hover:border-[var(--line-3)] hover:bg-[var(--bg-4)] hover:text-[var(--ink)]",
          leadingAvatar && "pl-1.5"
        )}
      >
        {leadingAvatar}
        {label && (
          <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--ink-4)]">
            {label}
          </span>
        )}
        <span>{current?.label ?? "—"}</span>
        <ChevronDown className="size-3" />
      </button>

      {open && coords && createPortal(
        <div
          ref={popoverRef}
          className="pop-in fixed z-[60] rounded-xl border border-[var(--line-3)] bg-[var(--bg-2)] p-1.5 shadow-[0_24px_60px_rgba(0,0,0,.7)] backdrop-blur-xl"
          // Usa `bottom` (não top + translateY) pra que o popover já nasça
          // ancorado pela borda inferior — sem flicker de "renderiza embaixo
          // primeiro, depois sobe via transform".
          style={{
            bottom: window.innerHeight - coords.top + 10,
            minWidth: width ?? 290,
            ...(align === "right"
              ? { right: window.innerWidth - coords.right }
              : { left: coords.left }),
          }}
        >
          {popoverFooter && (
            <p className="px-3 py-2 font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--ink-4)]">
              {popoverFooter}
            </p>
          )}
          {variantGrid ? (
            <div className="grid grid-cols-4 gap-1 p-1">
              {options.map((o) => (
                <button
                  key={String(o.value)}
                  onClick={() => {
                    onChange(o.value);
                    setOpen(false);
                  }}
                  className={cn(
                    "rounded-lg border px-1 py-3.5 text-center font-bold transition-all",
                    o.value === value
                      ? "border-transparent text-[#050507] shadow-[0_4px_12px_rgba(198,242,78,.3)]"
                      : "border-[var(--line-2)] bg-[var(--bg-3)] text-[var(--ink-2)] hover:bg-[var(--bg-4)] hover:text-[var(--ink)]"
                  )}
                  style={
                    o.value === value
                      ? { background: "var(--grad-cta)" }
                      : undefined
                  }
                >
                  <div className="text-[18px] leading-none">{o.label}</div>
                  {o.meta && (
                    <div className="mt-0.5 font-mono text-[9px] uppercase tracking-wider opacity-70">
                      {o.meta}
                    </div>
                  )}
                </button>
              ))}
            </div>
          ) : (
            <div className="scrollbar-thin max-h-[55vh] space-y-0.5 overflow-y-auto pr-1">
              {options.map((o) => {
                const active = o.value === value;
                const isDisabled = !!o.disabled;
                return (
                  <button
                    key={String(o.value)}
                    disabled={isDisabled}
                    onClick={() => {
                      if (isDisabled) return;
                      onChange(o.value);
                      setOpen(false);
                    }}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-left text-[13px] transition-colors",
                      isDisabled && "opacity-40 cursor-not-allowed",
                      !isDisabled && (
                        active
                          ? "bg-[rgba(255,255,255,.04)] text-[var(--ink)]"
                          : "text-[var(--ink-2)] hover:bg-[rgba(255,255,255,.04)] hover:text-[var(--ink)]"
                      )
                    )}
                  >
                    {o.avatar}
                    <div className="flex-1 overflow-hidden">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-[13px] font-medium text-[var(--ink)]">
                          {o.label}
                        </span>
                        {o.badge && (
                          <span
                            className="rounded font-mono text-[9px] uppercase tracking-[0.08em]"
                            style={{
                              background: "var(--bg-4)",
                              color: "var(--ink-3)",
                              padding: "1px 5px",
                            }}
                          >
                            {o.badge}
                          </span>
                        )}
                      </div>
                      {o.meta && (
                        <div className="truncate font-mono text-[11px] text-[var(--ink-3)]">
                          {o.meta}
                        </div>
                      )}
                    </div>
                    {active && (
                      <Check className="size-4" style={{ color: "var(--accent)" }} />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>,
        document.body
      )}
    </div>
  );
}
