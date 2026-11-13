"use client";

import { KeyRound, ShieldCheck, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useStudio } from "@/store/studio";
import { SetupInstructions } from "./SetupInstructions";

const TITLES: Record<string, string> = {
  NOT_CONFIGURED: "Integração de IA não configurada",
  RATE_LIMITED: "Muitas edições seguidas",
  CONTENT_REJECTED: "Imagem recusada pelo provedor",
  TIMEOUT: "Tempo esgotado",
  NETWORK: "Sem conexão",
  INVALID_INPUT: "Imagem inválida",
  PROVIDER_ERROR: "Não foi possível gerar a edição",
};

export function StudioDialogs() {
  const { error, dismissError, consentPending, giveConsent, apiStatus } = useStudio();

  return (
    <>
      <Modal
        open={!!error}
        onClose={dismissError}
        title={error ? TITLES[error.code] ?? "Erro" : ""}
        icon={
          error?.code === "NOT_CONFIGURED" ? <KeyRound className="h-5 w-5 text-brand-400" /> : <TriangleAlert className="h-5 w-5 text-amber-400" />
        }
        footer={
          <Button variant="primary" onClick={dismissError} data-testid="error-ok">
            Entendi
          </Button>
        }
      >
        <div data-testid="error-dialog" data-code={error?.code}>
          {error?.code === "NOT_CONFIGURED" ? <SetupInstructions /> : <p>{error?.message}</p>}
        </div>
      </Modal>

      <Modal
        open={consentPending}
        onClose={() => giveConsent(false)}
        title="Autorizar envio para a IA"
        icon={<ShieldCheck className="h-5 w-5 text-emerald-400" />}
        footer={
          <>
            <Button onClick={() => giveConsent(false)}>Agora não</Button>
            <Button variant="primary" onClick={() => giveConsent(true)} data-testid="consent-accept">
              Autorizo
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <p>
            Para gerar a simulação, sua foto (redimensionada e sem metadados) será enviada de forma segura ao provedor de IA
            {apiStatus?.provider ? <strong> ({apiStatus.provider === "openai" ? "OpenAI" : "Replicate"})</strong> : null} apenas para
            processar esta edição.
          </p>
          <ul className="space-y-1.5 text-zinc-400">
            <li>• Não publicamos nem compartilhamos sua foto.</li>
            <li>• Nosso servidor não grava a imagem em disco ou banco de dados.</li>
            <li>• Não usamos suas fotos para treinar modelos.</li>
            <li>• Você pode revogar esta autorização em Configurações.</li>
          </ul>
          <Link href="/privacidade" className="inline-block text-xs text-brand-300 underline-offset-2 hover:underline" target="_blank">
            Ler a política de privacidade
          </Link>
        </div>
      </Modal>
    </>
  );
}
