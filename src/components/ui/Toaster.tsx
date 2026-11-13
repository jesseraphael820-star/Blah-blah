"use client";

import { CircleCheck, Info, TriangleAlert, X } from "lucide-react";
import { useStudio } from "@/store/studio";
import { cn } from "@/lib/cn";

export function Toaster() {
  const { toasts, dismissToast } = useStudio();
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex flex-col items-center gap-2 px-4 lg:bottom-6" aria-live="polite">
      {toasts.map((t) => (
        <div
          key={t.id}
          role="status"
          className={cn(
            "glass-strong pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-2xl px-4 py-3 text-sm text-white shadow-2xl animate-fade-up",
          )}
        >
          {t.kind === "success" && <CircleCheck className="h-5 w-5 shrink-0 text-emerald-400" />}
          {t.kind === "error" && <TriangleAlert className="h-5 w-5 shrink-0 text-amber-400" />}
          {t.kind === "info" && <Info className="h-5 w-5 shrink-0 text-brand-400" />}
          <span className="flex-1">{t.text}</span>
          <button onClick={() => dismissToast(t.id)} className="text-zinc-400 hover:text-white" aria-label="Fechar aviso">
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
