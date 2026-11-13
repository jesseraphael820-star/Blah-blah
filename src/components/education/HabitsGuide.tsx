"use client";

import { useEffect, useState } from "react";
import { BedDouble, Check, Dumbbell, Droplets, GlassWater, Info, PersonStanding } from "lucide-react";
import { Card, SectionTitle } from "@/components/ui/Card";
import { cn } from "@/lib/cn";

const HABITS = [
  {
    id: "sono",
    icon: BedDouble,
    title: "Sono adequado",
    goal: "7 a 9 horas por noite",
    tips: ["Horários regulares para dormir e acordar.", "Evite telas brilhantes 1 hora antes de deitar.", "Quarto escuro, silencioso e fresco."],
    why: "Dormir pouco está associado a olheiras e aparência cansada.",
  },
  {
    id: "agua",
    icon: GlassWater,
    title: "Hidratação",
    goal: "Beba água ao longo do dia",
    tips: ["Tenha uma garrafa por perto.", "Aumente a ingestão em dias quentes e ao treinar.", "Reduza bebidas açucaradas e excesso de álcool."],
    why: "A necessidade varia por pessoa, clima e atividade — a sede e a cor da urina são bons guias.",
  },
  {
    id: "pele",
    icon: Droplets,
    title: "Cuidados básicos com a pele",
    goal: "Limpar, hidratar e proteger",
    tips: ["Sabonete facial suave de manhã e à noite.", "Hidratante adequado ao seu tipo de pele.", "Protetor solar FPS 30+ todos os dias, inclusive nublado."],
    why: "Protetor solar é o passo com mais evidência para prevenir manchas e envelhecimento precoce.",
  },
  {
    id: "postura",
    icon: PersonStanding,
    title: "Postura",
    goal: "Pausas e alinhamento",
    tips: ["Tela na altura dos olhos.", "Levante e alongue a cada 45–60 minutos.", "Ombros relaxados, peito aberto, queixo neutro."],
    why: "Boa postura melhora conforto e a forma como você aparece em fotos.",
  },
  {
    id: "exercicio",
    icon: Dumbbell,
    title: "Atividade física apropriada",
    goal: "150 min/semana de atividade moderada",
    tips: ["Combine exercícios aeróbicos e de força.", "Comece aos poucos e progrida com segurança.", "Procure orientação profissional se tiver condições de saúde."],
    why: "Recomendação geral da OMS para adultos; benefícios principais são para a saúde como um todo.",
  },
];

const KEY = "lmx-habits";

export function HabitsGuide() {
  const [done, setDone] = useState<Record<string, boolean>>({});
  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    try {
      const raw = JSON.parse(localStorage.getItem(KEY) || "{}") as { day?: string; done?: Record<string, boolean> };
      if (raw.day === today && raw.done) setDone(raw.done);
    } catch {}
  }, [today]);

  const toggle = (id: string) => {
    const next = { ...done, [id]: !done[id] };
    setDone(next);
    try {
      localStorage.setItem(KEY, JSON.stringify({ day: today, done: next }));
    } catch {}
  };
  const count = HABITS.filter((h) => done[h.id]).length;

  return (
    <div className="space-y-6" data-testid="habits-guide">
      <SectionTitle
        eyebrow="Exercícios e hábitos"
        title="Hábitos saudáveis"
        description="Informações educativas e gerais. Não prometemos transformações físicas e nada aqui substitui orientação médica ou profissional."
      />
      <Card className="flex flex-wrap items-center justify-between gap-4 p-5">
        <div>
          <p className="text-sm font-semibold text-white">Checklist de hoje</p>
          <p className="text-xs text-zinc-400">Marque o que você cuidou hoje. Fica salvo só neste dispositivo.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="h-2 w-40 overflow-hidden rounded-full bg-white/10">
            <div className="brand-gradient h-full transition-all duration-500" style={{ width: `${(count / HABITS.length) * 100}%` }} />
          </div>
          <span className="text-sm font-semibold text-white">
            {count}/{HABITS.length}
          </span>
        </div>
      </Card>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {HABITS.map((h) => {
          const Icon = h.icon;
          const checked = !!done[h.id];
          return (
            <Card key={h.id} className={cn("flex flex-col p-5 transition-all", checked && "ring-glow")}>
              <div className="flex items-start justify-between gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-2xl bg-brand-500/15 text-brand-300">
                  <Icon className="h-5 w-5" />
                </span>
                <button
                  onClick={() => toggle(h.id)}
                  role="checkbox"
                  aria-checked={checked}
                  aria-label={`Marcar ${h.title} como feito hoje`}
                  className={cn(
                    "grid h-7 w-7 place-items-center rounded-lg border transition-all",
                    checked ? "brand-gradient border-transparent text-white" : "border-white/20 text-transparent hover:border-brand-400",
                  )}
                >
                  <Check className="h-4 w-4" />
                </button>
              </div>
              <h3 className="mt-4 font-display text-lg font-semibold text-white">{h.title}</h3>
              <p className="text-xs font-medium text-brand-300">{h.goal}</p>
              <ul className="mt-3 flex-1 space-y-1.5 text-sm text-zinc-300">
                {h.tips.map((t) => (
                  <li key={t} className="flex gap-2">
                    <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-brand-400" />
                    {t}
                  </li>
                ))}
              </ul>
              <p className="mt-4 flex gap-1.5 border-t border-white/[0.06] pt-3 text-xs text-zinc-500">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {h.why}
              </p>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
