"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { GripVertical } from "lucide-react";
import { cn } from "@/lib/cn";

export type CompareMode = "slider" | "side";

interface Props {
  before: string;
  after: string;
  /** Proporção largura/altura da foto. */
  aspect: number;
  mode?: CompareMode;
  beforeLabel?: string;
  afterLabel?: string;
  className?: string;
  children?: ReactNode;
  initial?: number;
}

/**
 * Comparador interativo: arraste a barra vertical para revelar a imagem
 * original (esquerda) ou a editada (direita). Acessível por teclado.
 */
export function BeforeAfter({
  before,
  after,
  aspect,
  mode = "slider",
  beforeLabel = "ANTES",
  afterLabel = "DEPOIS",
  className,
  children,
  initial = 50,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState(initial);
  const [dragging, setDragging] = useState(false);
  const same = before === after;

  const setFromClientX = useCallback((clientX: number) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const p = ((clientX - rect.left) / rect.width) * 100;
    setPos(Math.max(0, Math.min(100, p)));
  }, []);

  useEffect(() => {
    if (!dragging) return;
    const move = (e: PointerEvent) => setFromClientX(e.clientX);
    const up = () => setDragging(false);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }, [dragging, setFromClientX]);

  const onKey = (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 10 : 2;
    if (e.key === "ArrowLeft") setPos((p) => Math.max(0, p - step));
    else if (e.key === "ArrowRight") setPos((p) => Math.min(100, p + step));
    else if (e.key === "Home") setPos(0);
    else if (e.key === "End") setPos(100);
    else return;
    e.preventDefault();
  };

  const label = (text: string, side: "left" | "right") => (
    <span
      className={cn(
        "pointer-events-none absolute top-3 z-10 rounded-full border border-white/15 bg-black/55 px-3 py-1 text-[11px] font-bold tracking-[0.16em] text-white backdrop-blur-md",
        side === "left" ? "left-3" : "right-3",
      )}
    >
      {text}
    </span>
  );

  if (mode === "side") {
    return (
      <div className={cn("relative grid grid-cols-2 gap-2 sm:gap-3", className)} data-testid="compare-side">
        {[
          { src: before, text: beforeLabel },
          { src: after, text: afterLabel },
        ].map((img, i) => (
          <div key={i} className="relative overflow-hidden rounded-2xl bg-ink-900" style={{ aspectRatio: aspect }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={img.src} alt={img.text} className="absolute inset-0 h-full w-full object-cover" draggable={false} />
            {label(img.text, "left")}
          </div>
        ))}
        {children && <div className="pointer-events-none absolute inset-0">{children}</div>}
      </div>
    );
  }

  return (
    <div
      ref={ref}
      data-testid="compare-slider"
      className={cn("relative touch-none overflow-hidden rounded-2xl bg-ink-900 select-none", className, dragging ? "cursor-grabbing" : "cursor-ew-resize")}
      style={{ aspectRatio: aspect }}
      onPointerDown={(e) => {
        if (same) return;
        if ((e.target as HTMLElement).closest("[data-no-drag]")) return;
        setDragging(true);
        setFromClientX(e.clientX);
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={after} alt={afterLabel} className="absolute inset-0 h-full w-full object-cover" draggable={false} />
      {!same && (
        <>
          <div className="absolute inset-0" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={before} alt={beforeLabel} className="absolute inset-0 h-full w-full object-cover" draggable={false} />
          </div>
          {pos > 8 && label(beforeLabel, "left")}
          {pos < 92 && label(afterLabel, "right")}
          <div className="pointer-events-none absolute inset-y-0 z-10 w-0.5 -translate-x-1/2 bg-white/90 shadow-[0_0_18px_rgba(167,139,250,0.9)]" style={{ left: `${pos}%` }} />
          <button
            type="button"
            role="slider"
            aria-label="Controle antes e depois"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(pos)}
            aria-valuetext={`${Math.round(pos)}% antes`}
            onKeyDown={onKey}
            className={cn(
              "absolute top-1/2 z-20 grid h-11 w-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-white/40 bg-black/50 text-white shadow-xl backdrop-blur-md transition-transform",
              dragging ? "scale-110 ring-glow" : "hover:scale-105",
            )}
            style={{ left: `${pos}%` }}
          >
            <GripVertical className="h-5 w-5" />
          </button>
        </>
      )}
      {same && label("ORIGINAL", "left")}
      {children}
    </div>
  );
}
