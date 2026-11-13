import type { Metadata } from "next";
import { SiteFooter } from "@/components/landing/SiteFooter";
import { SiteHeader } from "@/components/landing/SiteHeader";

export const metadata: Metadata = { title: "Privacidade" };

const SECTIONS = [
  {
    t: "1. Onde sua foto fica",
    p: "A foto enviada e o histórico de edições ficam armazenados apenas no seu navegador (IndexedDB). Você pode desativar esse armazenamento em Configurações — nesse caso, nada é guardado e tudo some ao fechar ou recarregar a página.",
  },
  {
    t: "2. Envio para a IA",
    p: "Somente quando você clica em “Aplicar com IA” — e depois de autorizar — a foto é redimensionada, tem metadados removidos (incluindo localização GPS) e é enviada por conexão segura ao nosso servidor, que a repassa ao provedor de IA configurado (OpenAI ou Replicate) para gerar aquela edição.",
  },
  {
    t: "3. O que nosso servidor faz",
    p: "O servidor processa a imagem apenas em memória, não grava em disco, banco de dados ou logs, e devolve o resultado diretamente para o seu navegador. As respostas não são armazenadas em cache.",
  },
  {
    t: "4. Provedores de IA",
    p: "Os provedores processam a imagem conforme suas próprias políticas. Pela política da OpenAI para a API, dados enviados não são usados para treinar modelos por padrão; o Replicate remove automaticamente entradas e saídas de previsões feitas pela API após um período curto. Consulte as políticas de cada provedor.",
  },
  {
    t: "5. Nunca publicamos nem compartilhamos",
    p: "Não publicamos suas fotos, não as compartilhamos com terceiros além do provedor necessário para a edição que você pediu, e não usamos suas imagens para treinar modelos.",
  },
  {
    t: "6. Exclusão",
    p: "Em Configurações você pode apagar o histórico ou todos os dados (foto, edições, favoritos e preferências) a qualquer momento. Também pode remover a foto diretamente na área “Minha foto”.",
  },
  {
    t: "7. Limitações",
    p: "As imagens são simulações visuais geradas por IA, para inspiração. Não representam resultados garantidos de tratamentos, produtos ou procedimentos e não substituem orientação médica, dermatológica ou profissional.",
  },
];

export default function PrivacyPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <p className="text-xs font-semibold tracking-[0.18em] text-emerald-400 uppercase">Privacidade</p>
        <h1 className="mt-2 font-display text-4xl font-bold tracking-tight text-white">Política de privacidade</h1>
        <p className="mt-4 text-zinc-400">Resumo direto de como tratamos suas fotos no LOOKSMAXXING AI.</p>
        <div className="mt-10 space-y-4">
          {SECTIONS.map((s) => (
            <section key={s.t} className="glass rounded-3xl p-6">
              <h2 className="font-display text-lg font-semibold text-white">{s.t}</h2>
              <p className="mt-2 text-sm leading-relaxed text-zinc-400">{s.p}</p>
            </section>
          ))}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
