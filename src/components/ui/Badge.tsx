import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type Tone = "brand" | "success" | "warning" | "danger" | "neutral";
const tones: Record<Tone, string> = {
  brand: "bg-brand-500/15 text-brand-300 border-brand-400/25",
  success: "bg-emerald-500/12 text-emerald-300 border-emerald-400/25",
  warning: "bg-amber-500/12 text-amber-300 border-amber-400/25",
  danger: "bg-red-500/12 text-red-300 border-red-400/25",
  neutral: "bg-white/[0.06] text-zinc-300 border-white/10",
};

export function Badge({ tone = "neutral", className, ...props }: HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium", tones[tone], className)}
      {...props}
    />
  );
}
