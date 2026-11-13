import Link from "next/link";
import {
  ArrowRight,
  Columns2,
  Droplets,
  Gem,
  Glasses,
  History,
  Lock,
  ScanFace,
  Scissors,
  ServerOff,
  ShieldCheck,
  Smile,
  Sparkles,
  Trash2,
  Upload,
  WandSparkles,
} from "lucide-react";
import { HeroUpload } from "@/components/landing/HeroUpload";
import { SiteFooter } from "@/components/landing/SiteFooter";
import { SiteHeader } from "@/components/landing/SiteHeader";

const FEATURES = [
  { icon: Droplets, title: "Skinmaxxing", text: "Pele mais uniforme, menos manchas e vermelhidão, hidratação e níveis de textura." },
  { icon: Scissors, title: "Hairmaxxing", text: "Low fade, mid fade, French crop, buzz cut, ondulado, cacheado e muito mais." },
  { icon: Smile, title: "Rosto", text: "Iluminação de estúdio, estilos de barba e contorno por luz — sem mudar sua anatomia." },
  { icon: Glasses, title: "Acessórios", text: "Boné Smashing, snapback, trucker, óculos aviador, wayfarer e outros estilos." },
  { icon: Gem, title: "Gua Sha", text: "Guia educativo de uso seguro da Gua Sha de aço, com expectativas realistas." },
  { icon: Columns2, title: "Antes | Depois", text: "Comparador deslizante, lado a lado, desfazer, histórico e download em alta qualidade." },
];

const STEPS = [
  { icon: Upload, title: "Envie sua foto", text: "Escolha da galeria ou tire uma foto. Removemos metadados como GPS automaticamente." },
  { icon: ScanFace, title: "Detecção do rosto", text: "Um modelo local no seu navegador encontra o rosto para orientar as simulações." },
  { icon: WandSparkles, title: "Simule com IA", text: "A IA altera só o que você escolheu e preserva sua identidade." },
  { icon: Columns2, title: "Compare e salve", text: "Arraste o controle ANTES | DEPOIS, favorite e baixe suas versões." },
];

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main>
        <section className="relative overflow-hidden">
          <div className="pointer-events-none absolute inset-0 grid-overlay" />
          <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 pt-12 pb-20 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:pt-20">
            <div className="animate-fade-up">
              <span className="inline-flex items-center gap-2 rounded-full border border-brand-400/30 bg-brand-500/10 px-3 py-1 text-xs font-medium text-brand-300">
                <Sparkles className="h-3.5 w-3.5" /> Estúdio de simulação visual com IA
              </span>
              <h1 className="mt-5 font-display text-4xl leading-[1.05] font-bold tracking-tight text-white sm:text-5xl lg:text-6xl">
                Veja sua melhor versão <span className="text-gradient">antes de mudar.</span>
              </h1>
              <p className="mt-5 max-w-xl text-base leading-relaxed text-zinc-400 sm:text-lg">
                Teste cortes de cabelo, cuidados com a pele, barba, iluminação e acessórios na sua própria foto. A IA preserva o seu rosto e
                você compara tudo em um controle <strong className="text-zinc-200">ANTES | DEPOIS</strong>.
              </p>
              <div className="mt-8 grid max-w-lg grid-cols-3 gap-3">
                {[
                  ["30+", "simulações"],
                  ["100%", "local no navegador"],
                  ["0", "fotos publicadas"],
                ].map(([n, l]) => (
                  <div key={l} className="glass rounded-2xl p-3 text-center">
                    <p className="font-display text-xl font-bold text-white">{n}</p>
                    <p className="text-[11px] text-zinc-400">{l}</p>
                  </div>
                ))}
              </div>
              <div className="mt-8 flex flex-wrap items-center gap-4 text-xs text-zinc-500">
                <span className="flex items-center gap-1.5"><ShieldCheck className="h-4 w-4 text-emerald-400" /> Privacidade em primeiro lugar</span>
                <span className="flex items-center gap-1.5"><Lock className="h-4 w-4 text-brand-400" /> Chaves de API só no servidor</span>
              </div>
            </div>
            <div className="relative animate-fade-up [animation-delay:120ms]">
              <div className="pointer-events-none absolute -inset-6 rounded-[2.5rem] bg-brand-600/20 blur-3xl" />
              <HeroUpload />
            </div>
          </div>
        </section>

        <section id="ferramentas" className="mx-auto max-w-7xl scroll-mt-20 px-4 py-20 sm:px-6">
          <p className="text-xs font-semibold tracking-[0.18em] text-brand-400 uppercase">Ferramentas</p>
          <h2 className="mt-2 font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">Tudo que você quer testar, em um só lugar</h2>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.title} className="glass group rounded-3xl p-6 transition-all duration-300 hover:-translate-y-1 hover:border-brand-400/30">
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-500/15 text-brand-300 transition-colors group-hover:bg-brand-500/25">
                  <f.icon className="h-6 w-6" />
                </span>
                <h3 className="mt-5 font-display text-lg font-semibold text-white">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-400">{f.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="como-funciona" className="mx-auto max-w-7xl scroll-mt-20 px-4 py-20 sm:px-6">
          <p className="text-xs font-semibold tracking-[0.18em] text-brand-400 uppercase">Como funciona</p>
          <h2 className="mt-2 font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">Quatro passos. Sem complicação.</h2>
          <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s, i) => (
              <div key={s.title} className="glass relative rounded-3xl p-6">
                <span className="absolute top-5 right-6 font-display text-4xl font-bold text-white/[0.06]">0{i + 1}</span>
                <s.icon className="h-6 w-6 text-brand-300" />
                <h3 className="mt-4 font-semibold text-white">{s.title}</h3>
                <p className="mt-2 text-sm text-zinc-400">{s.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="privacidade" className="mx-auto max-w-7xl scroll-mt-20 px-4 py-20 sm:px-6">
          <div className="glass relative overflow-hidden rounded-[2rem] p-8 sm:p-12">
            <div className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full bg-brand-600/25 blur-3xl" />
            <div className="relative grid gap-10 lg:grid-cols-2">
              <div>
                <p className="text-xs font-semibold tracking-[0.18em] text-emerald-400 uppercase">Segurança e privacidade</p>
                <h2 className="mt-2 font-display text-3xl font-bold tracking-tight text-white">Sua foto é sua.</h2>
                <p className="mt-4 text-zinc-400">
                  Sua foto e seu histórico ficam no seu dispositivo. Quando você pede uma edição, a imagem é enviada ao provedor de IA apenas
                  para processar aquela edição — com sua autorização.
                </p>
                <Link href="/privacidade" className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-brand-300 hover:text-brand-400">
                  Política de privacidade <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
              <ul className="grid gap-3 sm:grid-cols-2">
                {[
                  { icon: ShieldCheck, t: "Nunca publicamos fotos" },
                  { icon: ServerOff, t: "Servidor não armazena imagens" },
                  { icon: Trash2, t: "Apague foto e histórico quando quiser" },
                  { icon: History, t: "Sem treino de modelos com suas fotos" },
                ].map((x) => (
                  <li key={x.t} className="flex items-center gap-3 rounded-2xl border border-white/[0.06] bg-black/20 p-4 text-sm text-zinc-200">
                    <x.icon className="h-5 w-5 shrink-0 text-emerald-400" /> {x.t}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 pb-24 text-center sm:px-6">
          <h2 className="font-display text-3xl font-bold text-white sm:text-4xl">Pronto para se ver de um jeito novo?</h2>
          <Link
            href="/studio"
            className="brand-gradient mt-8 inline-flex h-12 items-center gap-2 rounded-2xl px-7 font-semibold text-white shadow-[0_10px_30px_-10px_rgba(139,92,246,0.9)] transition hover:brightness-110"
          >
            Abrir o estúdio <ArrowRight className="h-5 w-5" />
          </Link>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
