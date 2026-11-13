"use client";

import { useState } from "react";
import { CircleCheck, Cpu, KeyRound, RefreshCw, ShieldCheck, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, SectionTitle } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { Segmented } from "@/components/ui/Segmented";
import { Switch } from "@/components/ui/Switch";
import { INTENSITY_LABELS } from "@/lib/tools";
import type { Intensity } from "@/lib/types";
import { useStudio } from "@/store/studio";
import { SetupInstructions } from "./SetupInstructions";

function Row({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/[0.06] py-4 last:border-0">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-white">{title}</p>
        <p className="mt-0.5 text-xs text-zinc-400">{description}</p>
      </div>
      {children}
    </div>
  );
}

export function SettingsPanel() {
  const { settings, updateSettings, apiStatus, refreshStatus, clearHistory, wipeAll, history } = useStudio();
  const [confirm, setConfirm] = useState<null | "history" | "all">(null);
  const [checking, setChecking] = useState(false);

  return (
    <div className="space-y-6" data-testid="settings">
      <SectionTitle eyebrow="Configurações" title="Preferências e privacidade" />

      <Card className="p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-500/15 text-brand-300">
              <Cpu className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-semibold text-white">Integração de IA</p>
              <p className="text-xs text-zinc-400">
                {apiStatus?.configured ? `Provedor: ${apiStatus.provider === "openai" ? "OpenAI" : "Replicate"} · ${apiStatus.model}` : "Nenhum provedor configurado"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {apiStatus?.configured ? (
              <Badge tone="success">
                <CircleCheck className="h-3.5 w-3.5" /> Ativa
              </Badge>
            ) : (
              <Badge tone="warning">
                <KeyRound className="h-3.5 w-3.5" /> Não configurada
              </Badge>
            )}
            <Button
              size="sm"
              variant="ghost"
              loading={checking}
              onClick={async () => {
                setChecking(true);
                await refreshStatus();
                setChecking(false);
              }}
            >
              {!checking && <RefreshCw className="h-3.5 w-3.5" />} Verificar
            </Button>
          </div>
        </div>
        {!apiStatus?.configured && (
          <div className="mt-4 rounded-2xl border border-white/[0.06] bg-black/20 p-4">
            <SetupInstructions />
          </div>
        )}
      </Card>

      <Card className="px-6 py-2">
        <Row title="Aplicar edições sobre" description="Encadear edições (ex.: corte + boné) ou sempre partir da foto original para preservar ao máximo a identidade.">
          <Segmented
            size="sm"
            value={settings.applyOn}
            onChange={(v) => updateSettings({ applyOn: v })}
            options={[
              { value: "current", label: "Versão atual" },
              { value: "original", label: "Original" },
            ]}
          />
        </Row>
        <Row title="Intensidade padrão" description="Usada nas ferramentas de pele.">
          <Segmented
            size="sm"
            value={settings.defaultIntensity}
            onChange={(v) => updateSettings({ defaultIntensity: v })}
            options={(Object.keys(INTENSITY_LABELS) as Intensity[]).map((k) => ({ value: k, label: INTENSITY_LABELS[k] }))}
          />
        </Row>
        <Row
          title="Guardar foto e histórico neste dispositivo"
          description="Salvo apenas no navegador (IndexedDB). Desativar apaga o que está guardado; os dados somem ao recarregar."
        >
          <Switch checked={settings.saveHistory} onChange={(v) => updateSettings({ saveHistory: v })} label="Guardar dados localmente" />
        </Row>
        <Row title="Autorização de envio à IA" description="Permite enviar sua foto ao provedor de IA somente para processar cada edição.">
          <Switch checked={settings.aiConsent} onChange={(v) => updateSettings({ aiConsent: v })} label="Autorizar envio à IA" />
        </Row>
      </Card>

      <Card className="p-6">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-emerald-400" />
          <p className="text-sm font-semibold text-white">Seus dados</p>
        </div>
        <p className="mt-1 text-xs text-zinc-400">
          Fotos e histórico nunca são publicados nem usados para treinar modelos. Você pode apagar tudo a qualquer momento.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="danger" size="sm" onClick={() => setConfirm("history")} disabled={history.length === 0} data-testid="clear-history">
            <Trash2 className="h-3.5 w-3.5" /> Apagar histórico ({history.length})
          </Button>
          <Button variant="danger" size="sm" onClick={() => setConfirm("all")} data-testid="wipe-all">
            <Trash2 className="h-3.5 w-3.5" /> Apagar foto, histórico e preferências
          </Button>
        </div>
      </Card>

      <Modal
        open={!!confirm}
        onClose={() => setConfirm(null)}
        title={confirm === "all" ? "Apagar todos os dados?" : "Apagar histórico?"}
        icon={<Trash2 className="h-5 w-5 text-red-400" />}
        footer={
          <>
            <Button onClick={() => setConfirm(null)}>Cancelar</Button>
            <Button
              variant="danger"
              data-testid="confirm-wipe"
              onClick={() => {
                const c = confirm;
                setConfirm(null);
                void (c === "all" ? wipeAll() : clearHistory());
              }}
            >
              Apagar definitivamente
            </Button>
          </>
        }
      >
        {confirm === "all"
          ? "Sua foto, todas as edições, favoritos e preferências serão apagados deste dispositivo. Esta ação não pode ser desfeita."
          : "Todas as edições e favoritos serão apagados deste dispositivo. Esta ação não pode ser desfeita."}
      </Modal>
    </div>
  );
}
