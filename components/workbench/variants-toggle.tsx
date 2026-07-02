"use client";

import { cn } from "@/lib/utils";

const OPTIONS = [1, 2, 3, 4] as const;

export function VariantsToggle({
  value,
  onChange,
}: {
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="grid grid-cols-4 gap-1.5">
      {OPTIONS.map((n) => {
        const active = value === n;
        return (
          <button
            key={n}
            onClick={() => onChange(n)}
            className={cn(
              "flex h-12 items-center justify-center rounded-md border font-mono text-base font-medium transition-all",
              active
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border/60 bg-card/30 text-muted-foreground hover:border-border-strong hover:bg-accent/40 hover:text-foreground"
            )}
            aria-pressed={active}
          >
            {n}
          </button>
        );
      })}
    </div>
  );
}
