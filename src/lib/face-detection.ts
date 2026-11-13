"use client";

import type { FaceDetector } from "@mediapipe/tasks-vision";
import type { FaceBox, FaceResult } from "./types";

/** Na prévia estática os arquivos ficam ao lado da página (caminho relativo). */
const ASSET_BASE = process.env.NEXT_PUBLIC_STATIC_PREVIEW === "1" ? "./" : "/";

let detectorPromise: Promise<FaceDetector> | null = null;

/** Carrega o detector BlazeFace (MediaPipe) — executa localmente no navegador. */
function getDetector(): Promise<FaceDetector> {
  if (!detectorPromise) {
    detectorPromise = (async () => {
      const { FaceDetector, FilesetResolver } = await import("@mediapipe/tasks-vision");
      const fileset = await FilesetResolver.forVisionTasks(`${ASSET_BASE}mediapipe/wasm`);
      const create = (delegate: "GPU" | "CPU") =>
        FaceDetector.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: `${ASSET_BASE}models/blaze_face_short_range.tflite${process.env.NEXT_PUBLIC_STATIC_PREVIEW === "1" ? ".wasm" : ""}`, delegate },
          runningMode: "IMAGE",
          minDetectionConfidence: 0.5,
        });
      try {
        return await create("GPU");
      } catch {
        return await create("CPU");
      }
    })().catch((err) => {
      detectorPromise = null;
      throw err;
    });
  }
  return detectorPromise;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export async function detectFaces(dataUrl: string): Promise<FaceResult> {
  try {
    const [detector, img] = await Promise.all([getDetector(), loadImage(dataUrl)]);
    const result = detector.detect(img);
    const W = img.naturalWidth;
    const H = img.naturalHeight;
    const faces: FaceBox[] = result.detections
      .filter((d) => d.boundingBox)
      .map((d) => ({
        x: d.boundingBox!.originX / W,
        y: d.boundingBox!.originY / H,
        width: d.boundingBox!.width / W,
        height: d.boundingBox!.height / H,
        score: d.categories?.[0]?.score ?? 0,
        keypoints: (d.keypoints ?? []).map((k) => ({ x: k.x, y: k.y })),
      }))
      .sort((a, b) => b.width * b.height - a.width * a.height);
    return { status: faces.length === 0 ? "none" : faces.length > 1 ? "multiple" : "found", faces };
  } catch (err) {
    console.warn("Detecção de rosto indisponível:", err);
    return { status: "unavailable", faces: [] };
  }
}

/**
 * Calcula um recorte que enquadra o rosto principal (cabeça + ombros),
 * útil para a IA trabalhar com mais detalhe no rosto e no cabelo.
 */
export function faceCropRect(face: FaceBox, imgW: number, imgH: number) {
  const cx = (face.x + face.width / 2) * imgW;
  const cy = (face.y + face.height / 2) * imgH;
  const side = Math.min(Math.max(face.width * imgW, face.height * imgH) * 2.6, imgW, imgH);
  let x = cx - side / 2;
  let y = cy - side * 0.45;
  x = Math.max(0, Math.min(x, imgW - side));
  y = Math.max(0, Math.min(y, imgH - side));
  return { x: x / imgW, y: y / imgH, width: side / imgW, height: side / imgH };
}
