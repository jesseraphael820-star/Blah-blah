import Link from "next/link";
import { Logo } from "@/components/ui/Logo";

export function SiteFooter() {
  return (
    <footer className="border-t border-white/[0.06]">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-10 sm:px-6 md:flex-row md:items-center md:justify-between">
        <div>
          <Logo />
          <p className="mt-3 max-w-md text-xs leading-relaxed text-zinc-500">
            Simulações visuais geradas por IA para fins de entretenimento e inspiração. Não representam resultados garantidos, não são
            aconselhamento médico ou estético e não alteram sua aparência real.
          </p>
        </div>
        <div className="flex gap-6 text-sm text-zinc-400">
          <Link href="/studio" className="hover:text-white">Estúdio</Link>
          <Link href="/privacidade" className="hover:text-white">Privacidade</Link>
        </div>
      </div>
      <p className="pb-8 text-center text-xs text-zinc-600">© {new Date().getFullYear()} LOOKSMAXXING AI</p>
    </footer>
  );
}
