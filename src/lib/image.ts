"use client";

export const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const MAX_FILE_BYTES = 15 * 1024 * 1024;

export class ImageError extends Error {}

export interface PreparedImage {
  dataUrl: string;
  width: number;
  height: number;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new ImageError("Não foi possível ler a imagem."));
    img.src = src;
  });
}

function canvasToDataUrl(canvas: HTMLCanvasElement, quality = 0.92) {
  return canvas.toDataURL("image/jpeg", quality);
}

/**
 * Valida e normaliza a foto: corrige a orientação, redimensiona e re-codifica em JPEG.
 * A re-codificação remove metadados EXIF (incluindo localização GPS).
 */
export async function prepareImageFile(file: File, maxSide = 1536): Promise<PreparedImage> {
  if (!ACCEPTED_TYPES.includes(file.type)) {
    throw new ImageError("Formato não suportado. Envie uma foto JPG, PNG ou WEBP.");
  }
  if (file.size > MAX_FILE_BYTES) throw new ImageError("A foto é muito grande (máx. 15 MB).");

  let source: ImageBitmap | HTMLImageElement;
  let objectUrl: string | null = null;
  try {
    source = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    objectUrl = URL.createObjectURL(file);
    source = await loadImage(objectUrl);
  }
  try {
    const w = source.width;
    const h = source.height;
    if (w < 128 || h < 128) throw new ImageError("A foto é muito pequena. Use uma imagem com pelo menos 128 px.");
    const scale = Math.min(1, maxSide / Math.max(w, h));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(w * scale);
    canvas.height = Math.round(h * scale);
    const ctx = canvas.getContext("2d")!;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
    return { dataUrl: canvasToDataUrl(canvas), width: canvas.width, height: canvas.height };
  } finally {
    if ("close" in source) source.close();
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  }
}

/** Redimensiona um dataURL para um lado máximo (usado antes de enviar à IA). */
export async function resizeDataUrl(dataUrl: string, maxSide: number, quality = 0.9): Promise<PreparedImage> {
  const img = await loadImage(dataUrl);
  const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.naturalWidth * scale);
  canvas.height = Math.round(img.naturalHeight * scale);
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return { dataUrl: canvasToDataUrl(canvas, quality), width: canvas.width, height: canvas.height };
}

/**
 * Ajusta o resultado da IA às dimensões da foto original (preenchimento "cover"),
 * para que o comparador antes/depois fique alinhado.
 */
export async function fitToSize(dataUrl: string, width: number, height: number): Promise<string> {
  const img = await loadImage(dataUrl);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  const scale = Math.max(width / img.naturalWidth, height / img.naturalHeight);
  const dw = img.naturalWidth * scale;
  const dh = img.naturalHeight * scale;
  ctx.drawImage(img, (width - dw) / 2, (height - dh) / 2, dw, dh);
  return canvasToDataUrl(canvas, 0.93);
}

/** Recorta a imagem (coordenadas normalizadas). */
export async function cropDataUrl(
  dataUrl: string,
  rect: { x: number; y: number; width: number; height: number },
): Promise<PreparedImage> {
  const img = await loadImage(dataUrl);
  const sx = Math.round(rect.x * img.naturalWidth);
  const sy = Math.round(rect.y * img.naturalHeight);
  const sw = Math.round(rect.width * img.naturalWidth);
  const sh = Math.round(rect.height * img.naturalHeight);
  const canvas = document.createElement("canvas");
  canvas.width = sw;
  canvas.height = sh;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
  return { dataUrl: canvasToDataUrl(canvas), width: sw, height: sh };
}

export async function makeThumbnail(dataUrl: string, maxSide = 320): Promise<string> {
  return (await resizeDataUrl(dataUrl, maxSide, 0.8)).dataUrl;
}

/** Gera uma imagem única com ANTES | DEPOIS lado a lado. */
export async function composeSideBySide(before: string, after: string): Promise<string> {
  const [a, b] = await Promise.all([loadImage(before), loadImage(after)]);
  const h = Math.min(1200, a.naturalHeight);
  const wa = Math.round((a.naturalWidth / a.naturalHeight) * h);
  const wb = Math.round((b.naturalWidth / b.naturalHeight) * h);
  const gap = 12;
  const canvas = document.createElement("canvas");
  canvas.width = wa + wb + gap;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#0b0912";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(a, 0, 0, wa, h);
  ctx.drawImage(b, wa + gap, 0, wb, h);
  const label = (text: string, x: number) => {
    const fs = Math.max(16, Math.round(h * 0.03));
    ctx.font = `700 ${fs}px Inter, system-ui, sans-serif`;
    const pad = fs * 0.6;
    const tw = ctx.measureText(text).width;
    ctx.fillStyle = "rgba(10,8,18,0.7)";
    ctx.beginPath();
    ctx.roundRect(x + pad, pad, tw + pad * 2, fs + pad, fs * 0.5);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.fillText(text, x + pad * 2, pad + fs * 0.95);
  };
  label("ANTES", 0);
  label("DEPOIS", wa + gap);
  return canvas.toDataURL("image/jpeg", 0.92);
}

export function downloadDataUrl(dataUrl: string, fileName: string) {
  const [meta, b64] = dataUrl.split(",");
  const mime = /data:([^;]+)/.exec(meta)?.[1] ?? "image/jpeg";
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const url = URL.createObjectURL(new Blob([bytes], { type: mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function slugify(s: string) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function dataUrlBytes(dataUrl: string) {
  const b64 = dataUrl.split(",")[1] ?? "";
  return Math.floor((b64.length * 3) / 4);
}
