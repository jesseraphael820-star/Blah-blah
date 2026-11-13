"use client";

import { useEffect, useState } from "react";
import { BookOpen, Clock, Gem, Heart, History, KeyRound, LayoutDashboard, Settings, User, WandSparkles } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { SectionTitle } from "@/components/ui/Card";
import { Logo } from "@/components/ui/Logo";
import { GuaShaGuide } from "@/components/education/GuaShaGuide";
import { HabitsGuide } from "@/components/education/HabitsGuide";
import { PhotoUploader } from "@/components/upload/PhotoUploader";
import { cn } from "@/lib/cn";
import { useStudio } from "@/store/studio";
import { StudioDialogs } from "./Dialogs";
import { Editor } from "./Editor";
import { HistoryGrid } from "./HistoryGrid";
import { SettingsPanel } from "./SettingsPanel";
import { ToolPanel } from "./ToolPanel";

export type Section = "editor" | "foto" | "recentes" | "favoritos" | "historico" | "guasha" | "habitos" | "config";

const NAV: { id: Section; label: string; icon: React.ComponentType<{ className?: string }>; mobile?: boolean }[] = [
  { id: "editor", label: "Ferramentas", icon: WandSparkles, mobile: true },
  { id: "foto", label: "Minha foto", icon: User, mobile: true },
  { id: "recentes", label: "Últimas simulações", icon: Clock },
  { id: "favoritos", label: "Favoritos", icon: Heart, mobile: true },
  { id: "historico", label: "Histórico", icon: History, mobile: true },
  { id: "guasha", label: "Gua Sha", icon: Gem },
  { id: "habitos", label: "Hábitos", icon: BookOpen },
  { id: "config", label: "Configurações", icon: Settings, mobile: true },
];

export function StudioShell() {
  const { photo, history, apiStatus, hydrated } = useStudio();
  const [section, setSectionState] = useState<Section>("editor");

  useEffect(() => {
    const h = window.location.hash.slice(1) as Section;
    if (NAV.some((n) => n.id === h)) setSectionState(h);
  }, []);

  const setSection = (s: Section) => {
    setSectionState(s);
    window.history.replaceState(null, "", `#${s}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const photoHistory = photo ? history.filter((h) => h.photoId === photo.id) : [];
  const favorites = history.filter((h) => h.favorite);
  const recent = history.slice(0, 8);

  return (
    <div className="min-h-dvh lg:flex">
      {/* Sidebar desktop */}
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-white/[0.06] bg-ink-950/60 p-4 backdrop-blur-xl lg:flex">
        <Logo className="px-2 py-1" />
        <nav className="mt-8 flex-1 space-y-1" aria-label="Painel">
          {NAV.map((n) => {
            const Icon = n.icon;
            const active = section === n.id;
            const count = n.id === "favoritos" ? favorites.length : n.id === "historico" ? history.length : 0;
            return (
              <button
                key={n.id}
                onClick={() => setSection(n.id)}
                data-testid={`nav-${n.id}`}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
                  active ? "bg-brand-500/15 text-white ring-glow" : "text-zinc-400 hover:bg-white/[0.05] hover:text-white",
                )}
              >
                <Icon className={cn("h-4.5 w-4.5", active && "text-brand-300")} />
                <span className="flex-1 text-left">{n.label}</span>
                {count > 0 && <span className="rounded-md bg-white/10 px-1.5 text-[11px] text-zinc-300">{count}</span>}
              </button>
            );
          })}
        </nav>
        <div className="glass rounded-2xl p-3 text-xs">
          <p className="flex items-center gap-2 font-medium text-white">
            <span className={cn("h-2 w-2 rounded-full", apiStatus?.configured ? "bg-emerald-400 shadow-[0_0_10px_#34d399]" : "bg-amber-400")} />
            {apiStatus?.configured ? "IA conectada" : "IA não configurada"}
          </p>
          <p className="mt-1 text-zinc-500">
            {apiStatus?.configured ? `${apiStatus.provider === "openai" ? "OpenAI" : "Replicate"} · ${apiStatus.model}` : "Configure uma chave de API."}
          </p>
        </div>
      </aside>

      <div className="min-w-0 flex-1 pb-24 lg:pb-8">
        {/* Header */}
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-white/[0.06] bg-ink-950/70 px-4 py-3 backdrop-blur-xl sm:px-6 lg:px-8">
          <div className="lg:hidden">
            <Logo compact />
          </div>
          <div className="hidden items-center gap-2 text-sm text-zinc-400 lg:flex">
            <LayoutDashboard className="h-4 w-4" /> Painel <span className="text-zinc-600">/</span>
            <span className="text-white">{NAV.find((n) => n.id === section)?.label}</span>
          </div>
          <div className="flex items-center gap-2">
            {apiStatus && !apiStatus.configured && (
              <Badge tone="warning" className="cursor-pointer" onClick={() => setSection("config")} data-testid="api-not-configured">
                <KeyRound className="h-3.5 w-3.5" /> IA não configurada
              </Badge>
            )}
            {apiStatus?.configured && <Badge tone="success">IA ativa</Badge>}
            <button className="text-sm text-zinc-400 hover:text-white lg:hidden" onClick={() => setSection("guasha")}>
              Gua Sha
            </button>
            <button className="text-sm text-zinc-400 hover:text-white lg:hidden" onClick={() => setSection("habitos")}>
              Hábitos
            </button>
          </div>
        </header>

        <main className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8">
          {section === "editor" &&
            (hydrated && !photo ? (
              <div className="mx-auto max-w-2xl space-y-4">
                <SectionTitle eyebrow="Comece aqui" title="Envie sua foto" description="A foto será usada como referência para todas as simulações." />
                <PhotoUploader compact />
              </div>
            ) : (
              <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
                <div className="min-w-0 space-y-6">
                  <Editor />
                  {recent.length > 0 && (
                    <div className="hidden lg:block">
                      <SectionTitle
                        title="Últimas simulações"
                        className="mb-3"
                        action={
                          <Button size="sm" variant="ghost" onClick={() => setSection("historico")}>
                            Ver histórico
                          </Button>
                        }
                      />
                      <HistoryGrid items={recent.slice(0, 4)} empty={null} />
                    </div>
                  )}
                </div>
                <div className="lg:sticky lg:top-20 lg:self-start">
                  <ToolPanel onOpenGuide={setSection} />
                </div>
              </div>
            ))}

          {section === "foto" && (
            <div className="mx-auto max-w-2xl space-y-4">
              <SectionTitle eyebrow="Referência" title="Minha foto" description="Usada como base para todas as simulações. Você pode trocar ou remover quando quiser." />
              <PhotoUploader compact footer={photo && <Button variant="primary" className="w-full" onClick={() => setSection("editor")}>Ir para as ferramentas</Button>} />
            </div>
          )}

          {section === "recentes" && (
            <div className="space-y-4">
              <SectionTitle eyebrow="Atividade" title="Últimas simulações" description="As edições mais recentes geradas neste dispositivo." />
              <HistoryGrid items={recent} empty="Nenhuma simulação ainda. Escolha uma ferramenta e clique em “Aplicar com IA”." onUse={() => setSection("editor")} />
            </div>
          )}

          {section === "favoritos" && (
            <div className="space-y-4">
              <SectionTitle eyebrow="Coleção" title="Favoritos" description="Toque no coração de uma edição para guardá-la aqui." />
              <HistoryGrid items={favorites} empty="Você ainda não favoritou nenhuma edição." onUse={() => setSection("editor")} />
            </div>
          )}

          {section === "historico" && (
            <div className="space-y-4">
              <SectionTitle
                eyebrow="Registro"
                title="Histórico de edições"
                description={`${photoHistory.length} edição(ões) da foto atual · ${history.length} no total. Edições de fotos anteriores podem ser baixadas, mas não abertas no comparador.`}
              />
              <HistoryGrid items={history} empty="O histórico está vazio." onUse={() => setSection("editor")} />
            </div>
          )}

          {section === "guasha" && <GuaShaGuide />}
          {section === "habitos" && <HabitsGuide />}
          {section === "config" && <SettingsPanel />}
        </main>
      </div>

      {/* Navegação inferior mobile */}
      <nav className="glass-strong fixed inset-x-0 bottom-0 z-40 flex justify-around border-t border-white/10 px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] lg:hidden" aria-label="Painel">
        {NAV.filter((n) => n.mobile).map((n) => {
          const Icon = n.icon;
          const active = section === n.id;
          return (
            <button
              key={n.id}
              onClick={() => setSection(n.id)}
              aria-current={active ? "page" : undefined}
              className={cn("flex min-w-0 flex-1 flex-col items-center gap-1 rounded-xl py-1.5 text-[10px] font-medium", active ? "text-white" : "text-zinc-500")}
            >
              <Icon className={cn("h-5 w-5", active && "text-brand-300")} />
              <span className="truncate">{n.label}</span>
            </button>
          );
        })}
      </nav>

      <StudioDialogs />
    </div>
  );
}
