export type CategoryId = "pele" | "cabelo" | "rosto" | "acessorios" | "guasha";

export type Intensity = "sutil" | "moderado" | "forte";

export interface ToolVariant {
  id: string;
  label: string;
  /** Trecho em inglês acrescentado ao prompt. */
  prompt: string;
  swatch?: string;
}

export interface ToolOption {
  id: string;
  label: string;
  description: string;
  /** Instrução em inglês enviada ao modelo de IA. */
  prompt: string;
  /** O que pode ser alterado (escopo da edição). */
  scope: string;
  emoji: string;
  intensity?: boolean;
  variants?: ToolVariant[];
}

export interface ToolGroup {
  id: string;
  title: string;
  options: ToolOption[];
}

export interface Category {
  id: CategoryId;
  label: string;
  subtitle: string;
  groups: ToolGroup[];
  note?: string;
}

export interface FaceBox {
  /** Coordenadas normalizadas (0..1) relativas à imagem. */
  x: number;
  y: number;
  width: number;
  height: number;
  score: number;
  keypoints: { x: number; y: number }[];
}

export type FaceStatus = "idle" | "detecting" | "found" | "none" | "multiple" | "unavailable";

export interface FaceResult {
  status: FaceStatus;
  faces: FaceBox[];
}

export interface PhotoRecord {
  id: string;
  dataUrl: string;
  width: number;
  height: number;
  createdAt: number;
  face: FaceResult;
  fileName?: string;
}

export interface EditRequestMeta {
  toolId: string;
  variantId?: string;
  intensity?: Intensity;
}

export interface HistoryItem extends EditRequestMeta {
  id: string;
  photoId: string;
  label: string;
  categoryId: CategoryId;
  dataUrl: string;
  thumbUrl: string;
  /** Imagem usada como entrada da edição (para comparar com a versão anterior). */
  sourceId: string | null;
  provider: string;
  createdAt: number;
  favorite: boolean;
}

export interface Version {
  id: string;
  /** "original" ou id de item do histórico */
  historyId: string | null;
  dataUrl: string;
  label: string;
}

export interface Settings {
  applyOn: "current" | "original";
  saveHistory: boolean;
  aiConsent: boolean;
  defaultIntensity: Intensity;
}

export interface ApiStatus {
  configured: boolean;
  provider: "openai" | "replicate" | null;
  model: string | null;
}

export type EditErrorCode =
  | "NOT_CONFIGURED"
  | "INVALID_INPUT"
  | "RATE_LIMITED"
  | "PROVIDER_ERROR"
  | "CONTENT_REJECTED"
  | "TIMEOUT"
  | "NETWORK";

export interface EditError {
  code: EditErrorCode;
  message: string;
}
