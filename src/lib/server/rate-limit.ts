import "server-only";

/**
 * Limitador simples em memória (janela deslizante por IP). Em ambiente serverless
 * cada instância tem a própria memória, então é uma proteção de melhor esforço;
 * para produção em escala, troque por Redis/Upstash.
 */
const WINDOW_MS = 60_000;
const hits = new Map<string, number[]>();

export function checkRateLimit(key: string): { ok: boolean; retryAfter: number } {
  const limit = Math.max(1, Number(process.env.RATE_LIMIT_PER_MINUTE) || 8);
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= limit) {
    hits.set(key, recent);
    return { ok: false, retryAfter: Math.ceil((WINDOW_MS - (now - recent[0])) / 1000) };
  }
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000) {
    for (const [k, v] of hits) if (!v.some((t) => now - t < WINDOW_MS)) hits.delete(k);
  }
  return { ok: true, retryAfter: 0 };
}
