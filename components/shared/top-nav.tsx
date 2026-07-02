"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search } from "lucide-react";

import { cn } from "@/lib/utils";
import { useHealth } from "./engine-status-dot";
import { useCommandPalette } from "./command-palette";

const links = [
  { href: "/", label: "Workbench", pip: undefined as string | undefined },
  { href: "/personas", label: "Personas", pip: undefined as string | undefined },
  { href: "/history", label: "Histórico", pip: undefined as string | undefined },
  { href: "/settings", label: "Settings", pip: undefined as string | undefined },
];

export function TopNav() {
  const pathname = usePathname();
  const { open } = useCommandPalette();
  const { data: health } = useHealth();

  return (
    <header
      className="sticky top-0 z-30 grid items-center gap-6 border-b border-[var(--line)] bg-[rgba(5,5,7,0.85)] px-8 py-4 backdrop-blur-xl"
      style={{ gridTemplateColumns: "auto 1fr auto" }}
    >
      {/* Brand — âncora comum (não Link) para forçar reload completo da
          principal de qualquer página, inclusive quando já se está nela. */}
      <a
        href="/"
        aria-label="ThumbFast — início (recarregar)"
        className="flex items-center"
      >
        <Image
          src="/thumbfast-logo.png"
          alt="ThumbFast"
          width={586}
          height={123}
          loading="eager"
          fetchPriority="high"
          unoptimized
          className="h-12 w-auto"
        />
      </a>

      {/* Tabs */}
      <nav className="flex items-center gap-1 justify-self-center">
        {links.map((l) => {
          const active =
            l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
          return (
            <Link
              key={l.href}
              href={l.href}
              className={cn(
                "relative flex items-center gap-2 rounded-lg px-3.5 py-2 text-[13.5px] font-medium transition-all",
                active
                  ? "bg-[var(--bg-2)] text-[var(--ink)] shadow-[inset_0_0_0_1px_var(--line-2)]"
                  : "text-[var(--ink-3)] hover:text-[var(--ink)]"
              )}
            >
              {l.label}
              {l.pip && (
                <span
                  className="rounded font-mono text-[9px] font-bold uppercase tracking-wider"
                  style={{
                    background: "var(--accent)",
                    color: "#050507",
                    padding: "1px 5px",
                  }}
                >
                  {l.pip}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Right cluster */}
      <div className="flex items-center gap-2.5">
        <button
          onClick={open}
          className="hidden items-center gap-2 rounded-lg border border-[var(--line-2)] bg-[var(--bg-2)] px-3 py-1.5 text-[12.5px] text-[var(--ink-3)] transition-colors hover:border-[var(--line-3)] hover:text-[var(--ink-2)] md:flex"
          style={{ width: 240 }}
        >
          <Search className="size-3.5" />
          <span>Buscar comandos…</span>
          <span
            className="ml-auto rounded border border-[var(--line-2)] bg-[var(--bg-3)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--ink-3)]"
          >
            ⌘ K
          </span>
        </button>

        {/* Engine status pill */}
        <div className="flex items-center gap-2 rounded-full border border-[var(--line-2)] bg-[var(--bg-2)] px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--ink-3)]">
          <span className="flex items-center gap-1">
            <span
              className={cn(
                "inline-block size-1.5 rounded-full transition-colors",
                health?.glabs === "up" ? "bg-[var(--success)] pulse-dot" : "bg-[var(--danger)]"
              )}
            />
            G-Labs
          </span>
          <span className="text-[var(--ink-5)]">|</span>
          <span className="flex items-center gap-1">
            <span
              className={cn(
                "inline-block size-1.5 rounded-full",
                health?.claude === "configured"
                  ? "bg-[var(--success)] pulse-dot"
                  : "bg-[var(--danger)]"
              )}
            />
            Claude
          </span>
        </div>
      </div>
    </header>
  );
}
