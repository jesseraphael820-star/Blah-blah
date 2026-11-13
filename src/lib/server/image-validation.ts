import "server-only";

export const MAX_INPUT_BYTES = 4 * 1024 * 1024; // 4 MB (limite de corpo da Vercel é 4,5 MB)

export type AllowedMime = "image/jpeg" | "image/png" | "image/webp";

export interface DecodedImage {
  mime: AllowedMime;
  buffer: Buffer;
}

const DATA_URL_RE = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/;

/** Confere a assinatura real do arquivo (magic bytes), não apenas o MIME declarado. */
function sniffMime(buf: Buffer): AllowedMime | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  return null;
}

export function decodeImageDataUrl(input: unknown): DecodedImage | { error: string } {
  if (typeof input !== "string") return { error: "Imagem ausente." };
  if (input.length > Math.ceil((MAX_INPUT_BYTES * 4) / 3) + 64) return { error: "Imagem muito grande (máx. 4 MB)." };
  const m = DATA_URL_RE.exec(input);
  if (!m) return { error: "Formato de imagem inválido. Use JPEG, PNG ou WEBP." };
  const buffer = Buffer.from(m[2], "base64");
  if (buffer.length === 0 || buffer.length > MAX_INPUT_BYTES) return { error: "Imagem muito grande (máx. 4 MB)." };
  const sniffed = sniffMime(buffer);
  if (!sniffed) return { error: "O arquivo enviado não é uma imagem válida." };
  return { mime: sniffed, buffer };
}

export function bufferToDataUrl(buf: Buffer, fallbackMime = "image/png"): string {
  const mime = sniffMime(buf) ?? fallbackMime;
  return `data:${mime};base64,${buf.toString("base64")}`;
}
