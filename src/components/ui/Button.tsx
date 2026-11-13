import { forwardRef, type ButtonHTMLAttributes } from "react";
import { LoaderCircle } from "lucide-react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "outline";
type Size = "sm" | "md" | "lg" | "icon";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

const variants: Record<Variant, string> = {
  primary:
    "brand-gradient text-white shadow-[0_10px_30px_-10px_rgba(139,92,246,0.8)] hover:brightness-110 hover:shadow-[0_14px_40px_-10px_rgba(168,85,247,0.9)]",
  secondary: "bg-white/[0.07] text-white border border-white/10 hover:bg-white/[0.12] hover:border-white/20",
  outline: "border border-brand-400/40 text-brand-300 hover:bg-brand-500/10 hover:border-brand-400/70",
  ghost: "text-zinc-300 hover:text-white hover:bg-white/[0.06]",
  danger: "bg-red-500/10 text-red-300 border border-red-500/25 hover:bg-red-500/20 hover:text-red-200",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-xs gap-1.5 rounded-lg",
  md: "h-10 px-4 text-sm gap-2 rounded-xl",
  lg: "h-12 px-6 text-base gap-2.5 rounded-2xl",
  icon: "h-10 w-10 rounded-xl",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secondary", size = "md", loading, disabled, className, children, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        "inline-flex select-none items-center justify-center font-medium whitespace-nowrap transition-all duration-200 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-45",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {loading && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
});
