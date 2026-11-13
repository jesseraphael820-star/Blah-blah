import "server-only";
import type { ApiStatus } from "@/lib/types";

export type ProviderId = "openai" | "replicate";

export interface ProviderConfig {
  id: ProviderId;
  apiKey: string;
  model: string;
}

/** Lê a configuração do provedor a partir de variáveis de ambiente (nunca expostas ao cliente). */
export function getProviderConfig(): ProviderConfig | null {
  const explicit = (process.env.IMAGE_PROVIDER || "").trim().toLowerCase();
  const openaiKey = (process.env.OPENAI_API_KEY || "").trim();
  const replicateKey = (process.env.REPLICATE_API_TOKEN || "").trim();

  const openai = (): ProviderConfig | null =>
    openaiKey ? { id: "openai", apiKey: openaiKey, model: process.env.OPENAI_IMAGE_MODEL?.trim() || "gpt-image-1" } : null;
  const replicate = (): ProviderConfig | null =>
    replicateKey
      ? {
          id: "replicate",
          apiKey: replicateKey,
          model: process.env.REPLICATE_MODEL?.trim() || "black-forest-labs/flux-kontext-pro",
        }
      : null;

  if (explicit === "openai") return openai();
  if (explicit === "replicate") return replicate();
  return openai() ?? replicate();
}

export function getPublicStatus(): ApiStatus {
  const cfg = getProviderConfig();
  return { configured: !!cfg, provider: cfg?.id ?? null, model: cfg?.model ?? null };
}
