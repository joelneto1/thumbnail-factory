"use client";

const items = [
  { num: "Nano Banana Pro", txt: "G-Labs · local, plano MAX" },
  { num: "16:9 · 1920×1080", txt: "thumbnail-grade output" },
  { num: "~3.4s", txt: "tempo médio por variante" },
  { num: "Claude Opus 4.8", txt: "análise OCR + prompt assist" },
  { num: "0 cliques", txt: "do prompt à geração" },
  { num: "1 face ref", txt: "controla 100% da identidade" },
];

export function Marquee() {
  const all = [...items, ...items, ...items];
  return (
    <div
      className="relative overflow-hidden whitespace-nowrap border-y border-[var(--line)] py-3.5"
      style={{
        background:
          "linear-gradient(90deg, transparent, rgba(255,255,255,.015), transparent)",
      }}
    >
      <div className="marquee-track inline-flex gap-12 text-[14px] font-semibold tracking-[-0.01em] text-[var(--ink-3)] display">
        {all.map((it, i) => (
          <span key={i} className="inline-flex items-center gap-3">
            <span style={{ color: "var(--accent)" }}>✦</span>
            <span
              className="font-mono font-bold"
              style={{
                background: "var(--grad-cta)",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              {it.num}
            </span>
            <span>{it.txt}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
