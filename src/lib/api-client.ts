"use client";

import type { ApiStatus, EditError, EditRequestMeta } from "./types";

export class EditRequestError extends Error {
  constructor(public info: EditError) {
    super(info.message);
  }
}

export async function fetchStatus(): Promise<ApiStatus> {
  const res = await fetch("/api/status", { cache: "no-store" });
  if (!res.ok) throw new Error("status indisponível");
  return res.json();
}

export async function requestEdit(
  params: EditRequestMeta & { image: string; width: number; height: number },
  signal?: AbortSignal,
): Promise<{ image: string; provider: string }> {
  let res: Response;
  try {
    res = await fetch("/api/edit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
      signal,
    });
  } catch (err) {
    if ((err as Error).name === "AbortError") throw err;
    throw new EditRequestError({ code: "NETWORK", message: "Sem conexão com o servidor. Verifique sua internet." });
  }
  const json = (await res.json().catch(() => null)) as
    | { image?: string; provider?: string; error?: EditError }
    | null;
  if (!res.ok || !json?.image) {
    throw new EditRequestError(
      json?.error ?? { code: "PROVIDER_ERROR", message: `Falha ao editar a imagem (HTTP ${res.status}).` },
    );
  }
  return { image: json.image, provider: json.provider ?? "ia" };
}
