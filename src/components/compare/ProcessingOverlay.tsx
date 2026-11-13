"use client";

import { useEffect, useState } from "react";
import { Sparkles, X } from "lucide-react";
import type { Job } from "@/store/studio";

const STEPS = ["Analisando o rosto…", "Preservando a identidade…", "Aplicando a edição…", "Refinando detalhes…", "Finalizando…"];

export function ProcessingOverlay({ job, onCancel }: { job: Job; onCancel: () => void }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, []);
  const secs = Math.max(0, Math.floor((now - job.startedAt) / 1000));
  const step = STEPS[Math.min(STEPS.length - 1, Math.floor(secs / 7))];

  return (
    <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-ink-950/60 backdrop-blur-[3px]" data-testid="processing" data-no-drag>
      <div className="pointer-events-none absolute inset-x-0 h-24 animate-scan bg-gradient-to-b from-transparent via-brand-500/35 to-transparent" />
      <div className="pointer-events-none absolute inset-0 grid-overlay opacity-60" />
      <div className="glass-strong relative mx-4 flex max-w-xs flex-col items-center rounded-2xl px-6 py-5 text-center">
        <div className="relative mb-3 grid h-12 w-12 place-items-center">
          <span className="absolute inset-0 animate-spin rounded-full border-2 border-brand-500/20 border-t-brand-400" />
          <Sparkles className="h-5 w-5 text-brand-300" />
        </div>
        <p className="shimmer-text font-display text-base font-semibold">IA processando</p>
        <p className="mt-1 text-xs text-zinc-300">{job.label}</p>
        <p className="mt-2 text-xs text-zinc-500">
          {step} · {secs}s
        </p>
        <button onClick={onCancel} className="mt-3 inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-zinc-400 hover:bg-white/10 hover:text-white">
          <X className="h-3.5 w-3.5" /> Cancelar
        </button>
      </div>
    </div>
  );
}
