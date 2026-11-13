export function SetupInstructions() {
  return (
    <div className="space-y-3 text-sm" data-testid="setup-instructions">
      <p>
        Este app <strong>não simula</strong> edições: toda edição é gerada por um modelo real de IA no servidor. Para ativar, configure uma
        das integrações abaixo:
      </p>
      <ol className="list-decimal space-y-2 pl-5 text-zinc-300">
        <li>
          <strong>OpenAI</strong> — crie uma chave em platform.openai.com e defina{" "}
          <code className="rounded bg-white/10 px-1.5 py-0.5 text-brand-300">OPENAI_API_KEY</code>.
        </li>
        <li>
          <strong>ou Replicate (FLUX Kontext)</strong> — crie um token em replicate.com e defina{" "}
          <code className="rounded bg-white/10 px-1.5 py-0.5 text-brand-300">REPLICATE_API_TOKEN</code>.
        </li>
        <li>
          Localmente: copie <code className="rounded bg-white/10 px-1.5 py-0.5">.env.example</code> para{" "}
          <code className="rounded bg-white/10 px-1.5 py-0.5">.env.local</code> e reinicie o servidor. Na Vercel: Project → Settings →
          Environment Variables e faça um novo deploy.
        </li>
      </ol>
      <p className="text-xs text-zinc-500">As chaves ficam apenas no servidor e nunca são enviadas ao navegador.</p>
    </div>
  );
}
