import "server-only";
import type { ProviderConfig } from "../config";
import { ProviderError, type EditInput, type EditOutput } from "./types";

/** Escolhe o tamanho de saída suportado mais próximo da proporção da foto. */
function pickSize(width: number, height: number): string {
  const ratio = width / height;
  if (ratio > 1.2) return "1536x1024";
  if (ratio < 0.83) return "1024x1536";
  return "1024x1024";
}

export async function editWithOpenAI(cfg: ProviderConfig, input: EditInput): Promise<EditOutput> {
  const form = new FormData();
  const ext = input.image.mime.split("/")[1];
  form.append("image", new Blob([new Uint8Array(input.image.buffer)], { type: input.image.mime }), `photo.${ext}`);
  form.append("model", cfg.model);
  form.append("prompt", input.prompt);
  form.append("n", "1");
  form.append("size", pickSize(input.width, input.height));

  if (cfg.model.startsWith("gpt-image")) {
    form.append("quality", process.env.OPENAI_IMAGE_QUALITY?.trim() || "high");
    form.append("output_format", "jpeg");
    form.append("output_compression", "92");
    // "input_fidelity: high" preserva melhor rostos e detalhes da foto de entrada.
    if (!cfg.model.includes("mini")) form.append("input_fidelity", "high");
  } else {
    form.append("response_format", "b64_json");
  }

  let res: Response;
  try {
    res = await fetch("https://api.openai.com/v1/images/edits", {
      method: "POST",
      headers: { Authorization: `Bearer ${cfg.apiKey}` },
      body: form,
      signal: input.signal,
    });
  } catch (err) {
    if ((err as Error).name === "AbortError" || (err as Error).name === "TimeoutError")
      throw new ProviderError("TIMEOUT", "A IA demorou demais para responder. Tente novamente.", 504);
    throw new ProviderError("PROVIDER_ERROR", "Não foi possível conectar ao provedor de IA.");
  }

  const json = (await res.json().catch(() => null)) as
    | { data?: { b64_json?: string }[]; error?: { message?: string; code?: string; type?: string } }
    | null;

  if (!res.ok) {
    const msg = json?.error?.message ?? `Erro ${res.status}`;
    if (res.status === 401) throw new ProviderError("NOT_CONFIGURED", "Chave da OpenAI inválida. Verifique OPENAI_API_KEY.", 503);
    if (res.status === 429) throw new ProviderError("RATE_LIMITED", "Limite do provedor de IA atingido. Aguarde e tente novamente.", 429);
    if (json?.error?.code === "moderation_blocked" || /safety|moderation/i.test(msg))
      throw new ProviderError("CONTENT_REJECTED", "O provedor de IA recusou esta imagem pelas regras de segurança dele.", 422);
    console.error("[openai] edit failed", res.status, json?.error?.code ?? "", msg.slice(0, 300));
    throw new ProviderError("PROVIDER_ERROR", `O provedor de IA retornou um erro: ${msg.slice(0, 200)}`);
  }

  const b64 = json?.data?.[0]?.b64_json;
  if (!b64) throw new ProviderError("PROVIDER_ERROR", "O provedor de IA não retornou imagem.");
  return { buffer: Buffer.from(b64, "base64") };
}
