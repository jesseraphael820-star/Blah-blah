import "server-only";
import type { ProviderConfig } from "../config";
import { ProviderError, type EditInput, type EditOutput } from "./types";

interface Prediction {
  id: string;
  status: "starting" | "processing" | "succeeded" | "failed" | "canceled";
  output?: string | string[] | null;
  error?: string | null;
  urls?: { get?: string; cancel?: string };
}

const API = "https://api.replicate.com/v1";

function timeoutError() {
  return new ProviderError("TIMEOUT", "A IA demorou demais para responder. Tente novamente.", 504);
}

async function call<T>(cfg: ProviderConfig, url: string, init: RequestInit, signal: AbortSignal): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      signal,
      headers: { Authorization: `Bearer ${cfg.apiKey}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
    });
  } catch (err) {
    if ((err as Error).name === "AbortError" || (err as Error).name === "TimeoutError") throw timeoutError();
    throw new ProviderError("PROVIDER_ERROR", "Não foi possível conectar ao provedor de IA.");
  }
  const json = (await res.json().catch(() => null)) as (T & { detail?: string }) | null;
  if (!res.ok) {
    if (res.status === 401) throw new ProviderError("NOT_CONFIGURED", "Token do Replicate inválido. Verifique REPLICATE_API_TOKEN.", 503);
    if (res.status === 429) throw new ProviderError("RATE_LIMITED", "Limite do provedor de IA atingido. Aguarde e tente novamente.", 429);
    console.error("[replicate] request failed", res.status, String(json?.detail ?? "").slice(0, 300));
    throw new ProviderError("PROVIDER_ERROR", `O provedor de IA retornou um erro (${res.status}).`);
  }
  return json as T;
}

export async function editWithReplicate(cfg: ProviderConfig, input: EditInput): Promise<EditOutput> {
  const dataUrl = `data:${input.image.mime};base64,${input.image.buffer.toString("base64")}`;
  let prediction = await call<Prediction>(
    cfg,
    `${API}/models/${cfg.model}/predictions`,
    {
      method: "POST",
      headers: { Prefer: "wait=60" },
      body: JSON.stringify({
        input: {
          prompt: input.prompt,
          input_image: dataUrl,
          aspect_ratio: "match_input_image",
          output_format: "jpg",
          safety_tolerance: 2,
        },
      }),
    },
    input.signal,
  );

  while (prediction.status === "starting" || prediction.status === "processing") {
    await new Promise((r) => setTimeout(r, 1500));
    if (input.signal.aborted) throw timeoutError();
    prediction = await call<Prediction>(cfg, prediction.urls?.get ?? `${API}/predictions/${prediction.id}`, { method: "GET" }, input.signal);
  }

  if (prediction.status !== "succeeded") {
    const err = prediction.error ?? "falha desconhecida";
    if (/nsfw|safety|flagged/i.test(err))
      throw new ProviderError("CONTENT_REJECTED", "O provedor de IA recusou esta imagem pelas regras de segurança dele.", 422);
    throw new ProviderError("PROVIDER_ERROR", `A geração falhou: ${err.slice(0, 200)}`);
  }

  const url = Array.isArray(prediction.output) ? prediction.output[0] : prediction.output;
  if (!url || !/^https:\/\//.test(url)) throw new ProviderError("PROVIDER_ERROR", "O provedor de IA não retornou imagem.");
  let imgRes: Response;
  try {
    imgRes = await fetch(url, { signal: input.signal });
  } catch {
    throw new ProviderError("PROVIDER_ERROR", "Não foi possível baixar a imagem gerada.");
  }
  if (!imgRes.ok) throw new ProviderError("PROVIDER_ERROR", "Não foi possível baixar a imagem gerada.");
  return { buffer: Buffer.from(await imgRes.arrayBuffer()) };
}
