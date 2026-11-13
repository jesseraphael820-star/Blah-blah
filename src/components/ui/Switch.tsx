"use client";

import { cn } from "@/lib/cn";

export function Switch({ checked, onChange, label, id }: { checked: boolean; onChange: (v: boolean) => void; label: string; id?: string }) {
  return (
    <button
      id={id}
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative h-6 w-11 shrink-0 rounded-full border transition-colors",
        checked ? "border-brand-400/60 bg-brand-500" : "border-white/15 bg-white/10",
      )}
    >
      <span className={cn("absolute top-0.5 left-0.5 h-4.5 w-4.5 rounded-full bg-white shadow transition-transform", checked && "translate-x-5")} />
    </button>
  );
}
