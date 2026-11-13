import Link from "next/link";
import { Logo } from "@/components/ui/Logo";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-white/[0.05] bg-ink-950/60 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Logo />
        <nav className="hidden items-center gap-7 text-sm text-zinc-400 md:flex">
          <a href="#ferramentas" className="hover:text-white">Ferramentas</a>
          <a href="#como-funciona" className="hover:text-white">Como funciona</a>
          <a href="#privacidade" className="hover:text-white">Privacidade</a>
        </nav>
        <Link
          href="/studio"
          className="brand-gradient rounded-xl px-4 py-2 text-sm font-semibold text-white shadow-[0_8px_24px_-8px_rgba(139,92,246,0.9)] transition hover:brightness-110"
        >
          Abrir estúdio
        </Link>
      </div>
    </header>
  );
}
