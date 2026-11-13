import Link from "next/link";
import { cn } from "@/lib/cn";

export function Logo({ className, compact }: { className?: string; compact?: boolean }) {
  return (
    <Link href="/" className={cn("group flex items-center gap-2.5", className)} aria-label="LOOKSMAXXING AI — início">
      <span className="brand-gradient relative grid h-9 w-9 place-items-center rounded-xl shadow-[0_8px_24px_-8px_rgba(139,92,246,0.9)] transition-transform group-hover:scale-105">
        <svg viewBox="0 0 64 64" className="h-5 w-5" aria-hidden>
          <path d="M20 16v30h24" fill="none" stroke="#fff" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="43" cy="21" r="5.5" fill="#fff" />
        </svg>
      </span>
      {!compact && (
        <span className="font-display text-[15px] font-bold tracking-[0.08em] text-white">
          LOOKSMAXXING<span className="text-brand-400"> AI</span>
        </span>
      )}
    </Link>
  );
}
