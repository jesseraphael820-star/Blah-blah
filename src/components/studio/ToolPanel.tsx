"use client";

import { useEffect, useState } from "react";
import { BookOpen, Droplets, Glasses, Info, Scissors, Smile, Sparkles, Gem } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Segmented } from "@/components/ui/Segmented";
import { cn } from "@/lib/cn";
import { CATEGORIES, INTENSITY_LABELS, getTool } from "@/lib/tools";
import type { CategoryId, Intensity } from "@/lib/types";
import { useStudio } from "@/store/studio";

const ICONS: Record<CategoryId, React.ComponentType<{ className?: string }>> = {
  pele: Droplets,
  cabelo: Scissors,
  rosto: Smile,
  acessorios: Glasses,
  guasha: Gem,
};

export function ToolPanel({ onOpenGuide }: { onOpenGuide: (section: "guasha" | "habitos") => void }) {
  const { applyEdit, job, photo, settings } = useStudio();
  const [categoryId, setCategoryId] = useState<CategoryId>("cabelo");
  const [toolId, setToolId] = useState<string | null>(null);
  const [variantId, setVariantId] = useState<string | undefined>();
  const [intensity, setIntensity] = useState<Intensity>(settings.defaultIntensity);

  useEffect(() => setIntensity(settings.defaultIntensity), [settings.defaultIntensity]);

  const category = CATEGORIES.find((c) => c.id === categoryId)!;
  const selected = toolId ? getTool(toolId)?.option : undefined;

  const select = (id: string) => {
    setToolId(id);
    const opt = getTool(id)?.option;
    setVariantId(opt?.variants?.[0]?.id);
  };

  return (
    <div className="glass flex h-full flex-col rounded-3xl" data-testid="tool-panel">
      <div className="border-b border-white/[0.06] p-4 pb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-brand-400" />
          <h2 className="font-display text-base font-semibold text-white">Ferramentas de looksmaxxing</h2>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5" role="tablist" aria-label="Categorias">
          {CATEGORIES.map((c) => {
            const Icon = ICONS[c.id];
            const active = c.id === categoryId;
            return (
              <button
                key={c.id}
                role="tab"
                aria-selected={active}
                data-testid={`cat-${c.id}`}
                onClick={() => {
                  setCategoryId(c.id);
                  setToolId(null);
                }}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-medium transition-all",
                  active
                    ? "border-brand-400/50 bg-brand-500/20 text-white ring-glow"
                    : "border-white/[0.08] bg-white/[0.03] text-zinc-400 hover:border-white/20 hover:text-white",
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {c.label}
              </button>
            );
          })}
          <button
            onClick={() => onOpenGuide("habitos")}
            className="flex shrink-0 items-center gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-xs font-medium text-zinc-400 hover:border-white/20 hover:text-white"
          >
            <BookOpen className="h-3.5 w-3.5" /> Hábitos
          </button>
        </div>
      </div>

      <div className="scrollbar-thin flex-1 space-y-5 overflow-y-auto p-4 lg:max-h-[calc(100dvh-330px)]">
        <div>
          <p className="text-xs font-semibold tracking-[0.16em] text-brand-400 uppercase">{category.subtitle}</p>
          {category.note && (
            <p className="mt-1.5 flex gap-1.5 text-xs leading-relaxed text-zinc-400">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {category.note}
            </p>
          )}
          {categoryId === "guasha" && (
            <Button size="sm" variant="outline" className="mt-3" onClick={() => onOpenGuide("guasha")}>
              <BookOpen className="h-3.5 w-3.5" /> Guia completo de uso seguro
            </Button>
          )}
        </div>
        {category.groups.map((g) => (
          <div key={g.id}>
            <h3 className="mb-2 text-[13px] font-semibold text-zinc-200">{g.title}</h3>
            <div className="grid grid-cols-2 gap-2">
              {g.options.map((o) => {
                const active = o.id === toolId;
                return (
                  <button
                    key={o.id}
                    data-testid={`tool-${o.id}`}
                    aria-pressed={active}
                    onClick={() => select(o.id)}
                    className={cn(
                      "group flex flex-col items-start rounded-2xl border p-3 text-left transition-all duration-200",
                      active
                        ? "border-brand-400/60 bg-brand-500/[0.14] ring-glow"
                        : "border-white/[0.07] bg-white/[0.025] hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[0.05]",
                    )}
                  >
                    <span className="text-lg leading-none" aria-hidden>
                      {o.emoji}
                    </span>
                    <span className="mt-2 text-[13px] leading-tight font-semibold text-white">{o.label}</span>
                    <span className="mt-1 text-[11px] leading-snug text-zinc-400">{o.description}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-white/[0.06] p-4">
        {selected ? (
          <div className="space-y-3">
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-sm font-semibold text-white">{selected.label}</p>
              <span className="text-[11px] text-zinc-500">
                Aplicar sobre: {settings.applyOn === "original" ? "foto original" : "versão atual"}
              </span>
            </div>
            {selected.variants && (
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Cor">
                {selected.variants.map((v) => (
                  <button
                    key={v.id}
                    role="radio"
                    aria-checked={variantId === v.id}
                    onClick={() => setVariantId(v.id)}
                    className={cn(
                      "flex items-center gap-1.5 rounded-lg border px-2 py-1 text-xs transition-all",
                      variantId === v.id ? "border-brand-400/60 bg-brand-500/15 text-white" : "border-white/10 text-zinc-400 hover:text-white",
                    )}
                  >
                    <span className="h-3 w-3 rounded-full border border-white/30" style={{ background: v.swatch }} />
                    {v.label}
                  </button>
                ))}
              </div>
            )}
            {selected.intensity && (
              <Segmented
                ariaLabel="Intensidade"
                size="sm"
                className="w-full"
                value={intensity}
                onChange={setIntensity}
                options={(Object.keys(INTENSITY_LABELS) as Intensity[]).map((k) => ({ value: k, label: INTENSITY_LABELS[k] }))}
              />
            )}
            <Button
              variant="primary"
              size="lg"
              className="w-full"
              disabled={!photo || !!job}
              loading={!!job}
              data-testid="apply-edit"
              onClick={() => void applyEdit({ toolId: selected.id, variantId, intensity: selected.intensity ? intensity : undefined })}
            >
              {!job && <Sparkles className="h-5 w-5" />}
              {job ? "Gerando…" : "Aplicar com IA"}
            </Button>
          </div>
        ) : (
          <p className="py-2 text-center text-xs text-zinc-500">Selecione uma opção acima para simular com IA.</p>
        )}
      </div>
    </div>
  );
}
