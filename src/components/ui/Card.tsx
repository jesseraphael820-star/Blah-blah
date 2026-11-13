import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("glass rounded-3xl", className)} {...props} />;
}

export function SectionTitle({
  eyebrow,
  title,
  description,
  className,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  className?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-4", className)}>
      <div>
        {eyebrow && <p className="mb-1 text-xs font-semibold tracking-[0.18em] text-brand-400 uppercase">{eyebrow}</p>}
        <h2 className="font-display text-2xl font-semibold tracking-tight text-white sm:text-[1.7rem]">{title}</h2>
        {description && <p className="mt-1.5 max-w-2xl text-sm text-zinc-400">{description}</p>}
      </div>
      {action}
    </div>
  );
}
