import { cn } from "@/lib/utils";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative flex flex-col items-center justify-center gap-4 overflow-hidden rounded-2xl border border-dashed border-border/50 bg-card/30 px-8 py-16 text-center",
        className
      )}
    >
      {/* Subtle radial glow */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_30%,oklch(0.84_0.155_78_/_0.06),transparent_70%)]" />

      {Icon && (
        <span className="relative grid size-14 place-items-center rounded-full border border-border/60 bg-card text-muted-foreground/80">
          <Icon className="size-6" />
          <span className="absolute -inset-2 rounded-full border border-border/30" />
        </span>
      )}
      <div className="relative space-y-1.5 max-w-sm">
        <p className="font-display text-xl italic text-foreground">{title}</p>
        {description && (
          <p className="text-xs leading-relaxed text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {action && <div className="relative">{action}</div>}
    </div>
  );
}
