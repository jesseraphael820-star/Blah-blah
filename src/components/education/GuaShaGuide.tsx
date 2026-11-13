"use client";

import { CircleCheck, ShieldAlert, Sparkles, TriangleAlert } from "lucide-react";
import { BeforeAfter } from "@/components/compare/BeforeAfter";
import { Card, SectionTitle } from "@/components/ui/Card";
import { GuaShaTool } from "./GuaShaTool";
import { GUASHA_AFTER, GUASHA_BEFORE } from "./illustrations";

const STEPS = [
  { t: "Limpe a pele e a ferramenta", d: "Lave o rosto e higienize a Gua Sha de aço com água e sabão neutro ou álcool 70%." },
  { t: "Aplique um óleo ou sérum", d: "Uma camada fina evita atrito e permite que a ferramenta deslize sem puxar a pele." },
  { t: "Segure quase deitada", d: "Mantenha a ferramenta num ângulo de 15° a 30° em relação à pele, nunca na vertical." },
  { t: "Pressão leve", d: "Use pressão suave. A pele pode ficar levemente rosada, mas nunca dolorida ou roxa." },
  { t: "Movimentos para fora e para cima", d: "Do centro do rosto para as orelhas e do queixo em direção ao pescoço. Repita 5 a 10 vezes por região." },
  { t: "5 a 10 minutos", d: "Sessões curtas bastam. O aço gelado (guardado na geladeira) dá sensação refrescante." },
];

const AVOID = [
  "Acne inflamada, feridas, queimaduras de sol ou pele irritada.",
  "Rosácea em crise, varizes faciais visíveis ou após procedimentos estéticos recentes.",
  "Uso de anticoagulantes ou condições de pele — consulte um dermatologista antes.",
  "Pare imediatamente se houver dor, hematomas ou irritação persistente.",
];

export function GuaShaGuide() {
  return (
    <div className="space-y-6" data-testid="guasha-guide">
      <SectionTitle
        eyebrow="Ferramenta educativa"
        title="Gua Sha de aço"
        description="Técnica de massagem facial com uma placa de bordas lisas. Pode ajudar no relaxamento e reduzir temporariamente o inchaço — não muda a estrutura do rosto."
      />

      <div className="flex gap-3 rounded-2xl border border-amber-400/25 bg-amber-500/[0.08] p-4 text-sm text-amber-100">
        <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" />
        <p>
          <strong>Importante:</strong> Gua Sha <strong>não altera permanentemente a estrutura óssea do rosto</strong>, não “define a
          mandíbula” de forma definitiva e não substitui tratamento médico. Qualquer efeito visível é leve e temporário.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="flex flex-col items-center justify-center p-6">
          <GuaShaTool className="w-full max-w-sm animate-float" />
          <p className="mt-2 text-center text-sm font-medium text-white">Simulação do acessório: Gua Sha de aço inoxidável</p>
          <p className="mt-1 text-center text-xs text-zinc-400">
            Aço inox é fácil de higienizar, não quebra se cair e mantém a temperatura fria por mais tempo.
          </p>
          <p className="mt-4 flex items-center gap-1.5 text-xs text-brand-300">
            <Sparkles className="h-3.5 w-3.5" /> Para se ver usando a ferramenta, use a categoria “Gua Sha” no editor.
          </p>
        </Card>
        <Card className="p-4">
          <BeforeAfter before={GUASHA_BEFORE} after={GUASHA_AFTER} aspect={320 / 400} beforeLabel="ANTES" afterLabel="DEPOIS" className="mx-auto max-w-sm" />
          <p className="mt-3 text-center text-xs text-zinc-400">
            Comparação <strong>ilustrativa</strong> (desenho esquemático): à esquerda, inchaço matinal; à direita, após massagem leve — efeito temporário. As setas mostram a direção dos movimentos.
          </p>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Card className="p-6">
          <h3 className="font-display text-lg font-semibold text-white">Como usar com segurança</h3>
          <ol className="mt-4 space-y-4">
            {STEPS.map((s, i) => (
              <li key={s.t} className="flex gap-3">
                <span className="brand-gradient grid h-7 w-7 shrink-0 place-items-center rounded-lg text-xs font-bold text-white">{i + 1}</span>
                <div>
                  <p className="text-sm font-semibold text-white">{s.t}</p>
                  <p className="text-sm text-zinc-400">{s.d}</p>
                </div>
              </li>
            ))}
          </ol>
        </Card>
        <div className="space-y-6">
          <Card className="p-6">
            <h3 className="flex items-center gap-2 font-display text-lg font-semibold text-white">
              <TriangleAlert className="h-5 w-5 text-amber-400" /> Evite usar quando
            </h3>
            <ul className="mt-3 space-y-2.5">
              {AVOID.map((a) => (
                <li key={a} className="flex gap-2 text-sm text-zinc-300">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" /> {a}
                </li>
              ))}
            </ul>
          </Card>
          <Card className="p-6">
            <h3 className="font-display text-lg font-semibold text-white">O que esperar</h3>
            <ul className="mt-3 space-y-2.5 text-sm text-zinc-300">
              {["Sensação de relaxamento.", "Redução leve e temporária de inchaço.", "Pele momentaneamente mais corada."].map((t) => (
                <li key={t} className="flex gap-2">
                  <CircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" /> {t}
                </li>
              ))}
              <li className="flex gap-2 text-zinc-400">
                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-zinc-500" /> Não reduz gordura facial nem muda ossos.
              </li>
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
