import { NextResponse, type NextRequest } from "next/server";
import { getProviderConfig } from "@/lib/server/config";
import { bufferToDataUrl, decodeImageDataUrl } from "@/lib/server/image-validation";
import { checkRateLimit } from "@/lib/server/rate-limit";
import { ProviderError, runEdit } from "@/lib/server/providers";
import { buildPrompt, getTool } from "@/lib/tools";
import type { EditErrorCode, Intensity } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const INTENSITIES: Intensity[] = ["sutil", "moderado", "forte"];
const NO_STORE = { "Cache-Control": "no-store, max-age=0" };

function fail(code: EditErrorCode, message: string, status: number, extra?: HeadersInit) {
  return NextResponse.json({ error: { code, message } }, { status, headers: { ...NO_STORE, ...(extra ?? {}) } });
}

/**
 * Edita uma imagem com IA.
 * Privacidade: a imagem é processada em memória e repassada só ao provedor
 * configurado. Nada é gravado em disco, banco de dados ou logs.
 */
export async function POST(req: NextRequest) {
  const cfg = getProviderConfig();
  if (!cfg) {
    return fail(
      "NOT_CONFIGURED",
      "A integração de IA ainda não foi configurada. Defina OPENAI_API_KEY ou REPLICATE_API_TOKEN nas variáveis de ambiente do servidor.",
      503,
    );
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "local";
  const rl = checkRateLimit(ip);
  if (!rl.ok) {
    return fail("RATE_LIMITED", `Muitas edições em sequência. Aguarde ${rl.retryAfter}s.`, 429, {
      "Retry-After": String(rl.retryAfter),
    });
  }

  const contentLength = Number(req.headers.get("content-length") || 0);
  if (contentLength > 6 * 1024 * 1024) return fail("INVALID_INPUT", "Requisição muito grande.", 413);

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return fail("INVALID_INPUT", "JSON inválido.", 400);
  }

  const toolId = typeof body.toolId === "string" ? body.toolId : "";
  const tool = getTool(toolId);
  if (!tool) return fail("INVALID_INPUT", "Ferramenta desconhecida.", 400);

  const variantId = typeof body.variantId === "string" ? body.variantId : undefined;
  if (variantId && !tool.option.variants?.some((v) => v.id === variantId))
    return fail("INVALID_INPUT", "Variação inválida.", 400);

  const intensity = INTENSITIES.includes(body.intensity as Intensity) ? (body.intensity as Intensity) : undefined;

  const width = Number(body.width);
  const height = Number(body.height);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 64 || height < 64 || width > 4096 || height > 4096)
    return fail("INVALID_INPUT", "Dimensões de imagem inválidas.", 400);

  const image = decodeImageDataUrl(body.image);
  if ("error" in image) return fail("INVALID_INPUT", image.error, 400);

  const prompt = buildPrompt(toolId, variantId, intensity)!;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 110_000);
  req.signal.addEventListener("abort", () => controller.abort());

  try {
    const out = await runEdit(cfg, { image, prompt, width, height, signal: controller.signal });
    return NextResponse.json(
      { image: bufferToDataUrl(out.buffer, "image/jpeg"), provider: cfg.id, model: cfg.model },
      { headers: NO_STORE },
    );
  } catch (err) {
    if (err instanceof ProviderError) return fail(err.code, err.message, err.status);
    console.error("[edit] unexpected error", (err as Error)?.name);
    return fail("PROVIDER_ERROR", "Erro inesperado ao processar a edição.", 500);
  } finally {
    clearTimeout(timer);
  }
}
