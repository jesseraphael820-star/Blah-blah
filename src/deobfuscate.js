import { webcrack } from 'webcrack';

// Hard caps so a bad/huge URL can't exhaust the bot.
export const MAX_DOWNLOAD_BYTES = 8 * 1024 * 1024; // 8 MB
const DOWNLOAD_TIMEOUT_MS = 20_000;

/**
 * Download the raw text content at `url`, enforcing a timeout and a size cap.
 * Streams the body so we abort before buffering an oversized response.
 */
export async function downloadSource(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('URL inválida.');
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Só http(s) é suportado.');
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: { 'User-Agent': 'deobf-discord-bot' },
    });
    if (!res.ok) {
      throw new Error(`Falha no download: HTTP ${res.status}`);
    }

    // Reject early if the server advertises an oversized body.
    const declared = Number(res.headers.get('content-length'));
    if (Number.isFinite(declared) && declared > MAX_DOWNLOAD_BYTES) {
      throw new Error(`Arquivo grande demais (${declared} bytes, máx ${MAX_DOWNLOAD_BYTES}).`);
    }

    const reader = res.body.getReader();
    const chunks = [];
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > MAX_DOWNLOAD_BYTES) {
        controller.abort();
        throw new Error(`Arquivo grande demais (máx ${MAX_DOWNLOAD_BYTES} bytes).`);
      }
      chunks.push(value);
    }
    return Buffer.concat(chunks).toString('utf8');
  } catch (err) {
    if (err.name === 'AbortError') throw new Error('Download expirou (timeout).');
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Run webcrack over the source. Returns the deobfuscated/unminified code.
 * webcrack handles obfuscator.io output, generic unminify, string-array
 * unpacking, and webpack/browserify bundle splitting.
 */
export async function deobfuscate(source) {
  const result = await webcrack(source);
  return result.code;
}
